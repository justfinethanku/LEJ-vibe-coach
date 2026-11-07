import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { TestContext } from 'node:test'

import { createCoachStore } from '../server/store.js'
import type { CoachStoreOptions } from '../server/store.js'

const fixture = (t: TestContext) => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-coach-recovery-'))
  const path = join(directory, 'learner.sqlite')
  let db = new Database(path)
  db.pragma('journal_mode = WAL')
  const options: CoachStoreOptions = {
    project: { slug: 'recovery', title: 'Recovery', description: 'Local fixture' },
    track: { slug: 'basics', title: 'Basics', description: 'Local fixture' },
    researchDirectory: directory, researchMetadata: {},
    lessons: ['first', 'second'].map((slug, index) => ({
      slug, title: slug, stage: 'Foundations', difficulty: 'Intro', orderIndex: index + 1,
      estimatedMinutes: 5, summary: 'Recovery', goals: [], content: 'Lesson',
      relatedResearchSlugs: [], quizTitle: 'Quiz',
      quizQuestions: [{ prompt: `${slug} question`, options: ['Right', 'Wrong'],
        correctOption: 'Right', explanation: 'Original explanation' }],
    })),
  }
  let store = createCoachStore(db, options)
  store.initializeDatabase()
  store.syncSeedData()
  const reopen = () => {
    db.close()
    db = new Database(path)
    store = createCoachStore(db, options)
    store.initializeDatabase()
    return { db, store }
  }
  t.after(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })
  return { db, store, options, path, reopen }
}

const learnerRows = (db: Database.Database) =>
  ['lesson_progress', 'lesson_comments', 'quiz_attempts', 'quiz_responses']
    .map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all())

for (const change of ['choices', 'answer key']) {
  test(`a refresh of ${change} rejects an old page and preserves its original grading history after reopen`, (t) => {
    const fixtureData = fixture(t)
    const { options, reopen } = fixtureData
    let { db, store } = fixtureData
    store.updateLessonProgress('first', 'completed', 5)
    store.addLessonComment('first', 'Retain this learner note.', 'clear')
    const old = store.getLessonDetail('first')!.quiz
    const answers = [{ questionId: old.questions[0].id, selectedOption: 'Right' }]
    assert.equal(store.submitQuizAnswers(old.id, answers).score, 100)
    const history = learnerRows(db)
    const originalQuestion = db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(old.questions[0].id)
    if (change === 'choices') options.lessons[0].quizQuestions[0].options.push('New choice')
    else options.lessons[0].quizQuestions[0].correctOption = 'Wrong'
    store.syncSeedData()
    ;({ db, store } = reopen())
    assert.throws(() => store.submitQuizAnswers(old.id, answers), /exactly once/)
    assert.deepEqual(learnerRows(db), history)
    const current = store.getLessonDetail('first')!.quiz
    assert.notEqual(current.questions[0].id, old.questions[0].id)
    const retained = db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(old.questions[0].id) as Record<string, unknown>
    assert.deepEqual({ ...retained, order_index: 1, retired_at: null }, originalQuestion)
    assert.equal(store.submitQuizAnswers(current.id, [{
      questionId: current.questions[0].id, selectedOption: options.lessons[0].quizQuestions[0].correctOption,
    }]).score, 100)
    assert.equal(store.getLessonDetail('first')!.lesson.status, 'completed')
    // Explanation-only refinements do not invalidate the grading identity.
    options.lessons[0].quizQuestions[0].explanation = 'Clearer wording'
    store.syncSeedData()
    assert.equal(store.getLessonDetail('first')!.quiz.questions[0].id, current.questions[0].id)
    // Returning to the exact prior question reuses its history, not the replacement.
    if (change === 'choices') options.lessons[0].quizQuestions[0].options.pop()
    else options.lessons[0].quizQuestions[0].correctOption = 'Right'
    store.syncSeedData()
    assert.equal(store.getLessonDetail('first')!.quiz.questions[0].id, old.questions[0].id)
    assert.deepEqual(db.pragma('foreign_key_check'), [])
  })
}

test('a refresh committed by another connection before the quiz transaction cannot be scored from cached rows', (t) => {
  const { db, store, options, path } = fixture(t)
  const other = new Database(path)
  t.after(() => other.close())
  const refreshingStore = createCoachStore(other, options)
  const { quiz } = store.getLessonDetail('first')!
  const history = learnerRows(db)
  // Deterministically place a second connection's commit at the old
  // validation/BEGIN gap. This models a separate db:sync process, without sleeps.
  const transaction = db.transaction.bind(db)
  let refreshed = false
  db.transaction = ((fn: Parameters<typeof db.transaction>[0]) => {
    if (!refreshed) {
      refreshed = true
      options.lessons[0].quizQuestions[0].prompt = 'Replacement question'
      refreshingStore.syncSeedData()
    }
    return transaction(fn)
  }) as typeof db.transaction
  assert.throws(() => store.submitQuizAnswers(quiz.id, [{
    questionId: quiz.questions[0].id, selectedOption: 'Right',
  }]), /exactly once/)
  assert.equal(refreshed, true)
  assert.deepEqual(learnerRows(db), history)
  assert.equal(store.getLessonDetail('first')!.quiz.questions[0].prompt, 'Replacement question')
  assert.equal(db.inTransaction, false)
})

test('a failed note progress write does not publish the note, including after reopen and retry', (t) => {
  const fixtureData = fixture(t)
  let { db, store } = fixtureData
  store.addLessonComment('first', 'Keep the earlier note.', 'unsure')
  const history = learnerRows(db)
  db.exec(`CREATE TRIGGER fail_note_progress BEFORE UPDATE ON lesson_progress
    BEGIN SELECT RAISE(ABORT, 'fixture note progress failure'); END;`)
  assert.throws(() => store.addLessonComment('first', 'Publish only once after retry.', 'clear'), /fixture note progress failure/)
  assert.equal(db.inTransaction, false)
  ;({ db, store } = fixtureData.reopen())
  assert.deepEqual(learnerRows(db), history)
  db.exec('DROP TRIGGER fail_note_progress')
  const detail = store.addLessonComment('first', 'Publish only once after retry.', 'clear')!
  assert.equal(detail.comments.filter(({ body }) => body === 'Publish only once after retry.').length, 1)
  assert.equal(detail.comments.length, 2)
  assert.deepEqual(db.pragma('foreign_key_check'), [])
})

test('late curriculum publication failure rolls back replacements and retirement before reopen and retry', (t) => {
  const fixtureData = fixture(t)
  const { options } = fixtureData
  let { db, store } = fixtureData
  for (const slug of ['first', 'second']) {
    store.addLessonComment(slug, `Keep the ${slug} note.`, 'clear')
    const { quiz } = store.getLessonDetail(slug)!
    store.submitQuizAnswers(quiz.id, [{ questionId: quiz.questions[0].id, selectedOption: 'Right' }])
  }
  const snapshot = () => ['projects', 'learning_tracks', 'research_documents', 'lessons', 'quizzes', 'quiz_questions']
    .map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).concat(learnerRows(db))
  const before = snapshot()
  const old = store.getLessonDetail('first')!
  db.exec(`CREATE TRIGGER fail_retirement BEFORE UPDATE OF retired_at ON lessons
    WHEN NEW.slug = 'second' AND NEW.retired_at IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'fixture late refresh failure'); END;`)
  options.project.title = 'Refreshed project'
  options.lessons.pop()
  options.lessons[0].quizQuestions[0].correctOption = 'Wrong'
  assert.throws(() => store.syncSeedData(), /fixture late refresh failure/)
  assert.equal(db.inTransaction, false)
  ;({ db, store } = fixtureData.reopen())
  assert.deepEqual(snapshot(), before)
  db.exec('DROP TRIGGER fail_retirement')
  store.syncSeedData()
  assert.equal(store.getBootstrapData().project.title, 'Refreshed project')
  assert.equal(store.getBootstrapData().lessons.length, 1)
  assert.deepEqual(learnerRows(db), before.slice(-4))
  assert.throws(() => store.submitQuizAnswers(old.quiz.id, [{
    questionId: old.quiz.questions[0].id, selectedOption: 'Right',
  }]), /exactly once/)
  assert.deepEqual(db.pragma('foreign_key_check'), [])
})

test('a WAL refresh after quiz validation aborts the write rather than saving obsolete grading', (t) => {
  const { db, store, options, path } = fixture(t)
  const other = new Database(path)
  t.after(() => other.close())
  const refreshingStore = createCoachStore(other, options)
  const { quiz } = store.getLessonDetail('first')!
  const history = learnerRows(db)
  const prepare = db.prepare.bind(db)
  let refreshed = false
  db.prepare = ((sql: string) => {
    if (!refreshed && sql.includes('INSERT INTO quiz_attempts')) {
      refreshed = true
      options.lessons[0].quizQuestions[0].prompt = 'New concurrent question'
      refreshingStore.syncSeedData()
    }
    return prepare(sql)
  }) as typeof db.prepare
  assert.throws(() => store.submitQuizAnswers(quiz.id, [{
    questionId: quiz.questions[0].id, selectedOption: 'Right',
  }]), (error: unknown) => error instanceof Error &&
    'code' in error && error.code === 'SQLITE_BUSY_SNAPSHOT')
  assert.equal(refreshed, true)
  assert.equal(db.inTransaction, false)
  assert.deepEqual(learnerRows(db), history)
  const fresh = store.getLessonDetail('first')!.quiz
  assert.equal(store.submitQuizAnswers(fresh.id, [{
    questionId: fresh.questions[0].id, selectedOption: 'Right',
  }]).score, 100)
  assert.deepEqual(db.pragma('foreign_key_check'), [])
})
