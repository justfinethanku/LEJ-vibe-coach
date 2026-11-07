import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { TestContext } from 'node:test'

import { createCoachStore } from '../server/store.js'
import type { CoachStoreOptions } from '../server/store.js'

const fixture = (t: TestContext) => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-coach-snapshot-'))
  const path = join(directory, 'learner.sqlite')
  writeFileSync(join(directory, 'notes.md'), '# Original research\nBefore refresh.')
  let db = new Database(path)
  db.pragma('journal_mode = WAL')
  const writer = new Database(path)
  const options: CoachStoreOptions = {
    project: { slug: 'snapshot', title: 'Original project', description: 'Read consistency' },
    track: { slug: 'basics', title: 'Basics', description: 'Read consistency' },
    researchDirectory: directory, researchMetadata: {},
    lessons: ['first', 'second'].map((slug, index) => ({
      slug, title: `Original ${slug}`, stage: 'Foundations', difficulty: 'Intro',
      orderIndex: index + 1, estimatedMinutes: 5, summary: 'Before refresh',
      goals: [], content: 'Original lesson', relatedResearchSlugs: ['notes'],
      quizTitle: 'Original quiz', quizQuestions: [{
        prompt: `${slug} question`, options: ['Right', 'Wrong'],
        correctOption: 'Right', explanation: 'Original explanation',
      }],
    })),
  }
  let reader = createCoachStore(db, options)
  reader.initializeDatabase()
  reader.syncSeedData()
  const writingStore = createCoachStore(writer, options)
  for (const slug of ['first', 'second']) {
    writingStore.addLessonComment(slug, `Original ${slug} note`, 'clear')
    const { quiz } = reader.getLessonDetail(slug)!
    writingStore.submitQuizAnswers(quiz.id, [{ questionId: quiz.questions[0].id, selectedOption: 'Right' }])
  }

  const refresh = () => {
    options.project.title = 'Replacement project'
    options.lessons.pop()
    Object.assign(options.lessons[0], {
      title: 'Replacement first', content: 'Replacement lesson',
      relatedResearchSlugs: ['next'], quizTitle: 'Replacement quiz',
    })
    options.lessons[0].quizQuestions[0].correctOption = 'Wrong'
    rmSync(join(directory, 'notes.md'))
    writeFileSync(join(directory, 'next.md'), '# Replacement research\nAfter refresh.')
    writingStore.syncSeedData()
    writingStore.addLessonComment('first', 'New committed learner note', 'want_more_depth')
    const { quiz } = writingStore.getLessonDetail('first')!
    writingStore.submitQuizAnswers(quiz.id, [{ questionId: quiz.questions[0].id, selectedOption: 'Right' }])
    writingStore.updateLessonProgress('first', 'completed', 5)
  }

  // A real second connection commits precisely between two completed SELECTs.
  // No timer race, production data, or mocked SQL result is involved.
  const interleave = (fragment: string, action: () => void) => {
    const prepare = db.prepare.bind(db)
    let calls = 0
    db.prepare = ((sql: string) => {
      if (calls === 0 && sql.includes(fragment)) {
        calls++
        action()
      }
      return prepare(sql)
    }) as typeof db.prepare
    return {
      calls: () => calls,
      restore: () => { db.prepare = prepare },
    }
  }
  const reopen = () => {
    db.close()
    db = new Database(path)
    reader = createCoachStore(db, options)
    reader.initializeDatabase()
    return { db, reader }
  }
  t.after(() => {
    writer.close()
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  return { db, reader, refresh, interleave, reopen, path, options }
}

const bootstrapBoundaries = [
  ['project', 'lessons.stage'],
  ['lesson list', 'SELECT slug, title, summary, category'],
  ['research list', 'SELECT AVG(score)'],
] as const

for (const [boundary, fragment] of bootstrapBoundaries) {
  test(`bootstrap remains one committed version when refresh follows the ${boundary} read`, (t) => {
    const f = fixture(t)
    const before = f.reader.getBootstrapData()
    const gate = f.interleave(fragment, f.refresh)
    const during = f.reader.getBootstrapData()
    gate.restore()
    assert.equal(gate.calls(), 1, 'the second connection actually committed during this read')
    assert.deepEqual(during, before)
    assert.equal(f.db.inTransaction, false)
    const after = f.reader.getBootstrapData()
    assert.equal(after.project.title, 'Replacement project')
    assert.deepEqual(after.lessons.map(({ slug }) => slug), ['first'])
    assert.deepEqual(after.researchDocuments.map(({ slug }) => slug), ['next'])
    assert.equal(after.dashboard.totalLessons, 1)
    assert.equal(after.dashboard.completedLessons, 1)
    assert.equal(after.dashboard.attemptCount, 2)
    assert.equal(after.dashboard.averageQuizScore, 50)
    assert.equal(after.dashboard.followUpCount, 1)
    assert.deepEqual(f.reader.getBootstrapData(), after)
    assert.deepEqual(f.reopen().reader.getBootstrapData(), after)
  })
}

const detailBoundaries = [
  ['lesson', 'SELECT id, order_index AS orderIndex'],
  ['questions', 'SELECT id, body, understanding_state'],
  ['comments', 'SELECT id, score, total_questions'],
  ['attempts', 'SELECT slug, title, summary, category'],
] as const

for (const [boundary, fragment] of detailBoundaries) {
  test(`lesson detail remains one committed version when refresh follows the ${boundary} read`, (t) => {
    const f = fixture(t)
    const before = f.reader.getLessonDetail('first')!
    const gate = f.interleave(fragment, f.refresh)
    const during = f.reader.getLessonDetail('first')
    gate.restore()
    assert.equal(gate.calls(), 1, 'the second connection actually committed during this read')
    assert.deepEqual(during, before)
    assert.equal(f.db.inTransaction, false)
    const after = f.reader.getLessonDetail('first')!
    assert.equal(after.lesson.title, 'Replacement first')
    assert.equal(after.lesson.content, 'Replacement lesson')
    assert.equal(after.lesson.status, 'completed')
    assert.equal(after.lesson.confidence, 5)
    assert.equal(after.lesson.quizAverage, 50)
    assert.equal(after.quiz.title, 'Replacement quiz')
    assert.notEqual(after.quiz.questions[0].id, before.quiz.questions[0].id)
    assert.equal(after.comments.length, 2)
    assert.equal(after.quiz.recentAttempts.length, 2)
    assert.deepEqual(after.relatedResearch.map(({ slug }) => slug), ['next'])
    assert.deepEqual(f.reader.getLessonDetail('first'), after)
    assert.deepEqual(f.reopen().reader.getLessonDetail('first'), after)
  })
}

for (const view of ['bootstrap', 'lesson'] as const) {
  test(`${view} read failure releases its snapshot and retry sees the committed refresh after reopen`, (t) => {
    const f = fixture(t)
    const read = () => view === 'bootstrap' ? f.reader.getBootstrapData() : f.reader.getLessonDetail('first')
    const gate = f.interleave(view === 'bootstrap' ? 'SELECT AVG(score)' : 'SELECT id, score, total_questions', () => {
      f.refresh()
      throw new Error('Injected late read failure')
    })
    assert.throws(read, /Injected late read failure/)
    gate.restore()
    assert.equal(gate.calls(), 1)
    assert.equal(f.db.inTransaction, false)
    const after = read()
    assert.match(JSON.stringify(after), /Replacement/)
    assert.deepEqual(read(), after)
    const reopened = f.reopen()
    assert.deepEqual(view === 'bootstrap' ? reopened.reader.getBootstrapData() : reopened.reader.getLessonDetail('first'), after)
    assert.deepEqual(reopened.db.pragma('foreign_key_check'), [])
    const detail = reopened.reader.addLessonComment('first', 'A successful write after the failed read', 'clear')!
    assert.equal(detail.comments.length, 3)
  })
}

test('read-only connections and missing lessons remain usable without publishing learner writes', (t) => {
  const f = fixture(t)
  const readonly = new Database(f.path, { readonly: true })
  t.after(() => readonly.close())
  const reader = createCoachStore(readonly, f.options)
  assert.deepEqual(reader.getBootstrapData(), f.reader.getBootstrapData())
  assert.deepEqual(reader.getLessonDetail('first'), f.reader.getLessonDetail('first'))
  assert.equal(reader.getLessonDetail('missing'), null)
  assert.equal(readonly.inTransaction, false)
  assert.equal(reader.getBootstrapData().dashboard.attemptCount, 2)
})
