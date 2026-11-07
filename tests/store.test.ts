import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createCoachStore } from '../server/store.js'
import type { CoachStoreOptions } from '../server/store.js'

const curriculum = (researchDirectory: string, title = 'Fixture project'): CoachStoreOptions => ({
  project: { slug: 'fixture', title, description: 'An isolated teaching engine' },
  track: { slug: 'basics', title: 'Basics', description: 'First steps' },
  researchDirectory,
  researchMetadata: { 'notes.md': { summary: 'Research summary', category: 'orientation' } },
  lessons: [{
    slug: 'orientation', title: 'Orientation', stage: 'Foundations', difficulty: 'Intro',
    orderIndex: 1, estimatedMinutes: 5, summary: 'Understand the boundary',
    goals: ['Explain the boundary'], relatedResearchSlugs: ['notes'], content: '## Lesson\nRead the notes.',
    quizTitle: 'Check your understanding', quizQuestions: [{
      prompt: 'Which store owns your progress?', options: ['This one', 'Another one'],
      correctOption: 'This one', explanation: 'Each connection owns its learner state.',
    }],
  }],
})

const researchFixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-coach-store-'))
  writeFileSync(join(directory, 'notes.md'), '# Boundary notes\nOriginal research.')
  return directory
}

test('two stores isolate curriculum, research and all learner writes on explicit connections', (t) => {
  const firstDirectory = researchFixture()
  const secondDirectory = researchFixture()
  writeFileSync(join(secondDirectory, 'notes.md'), '# Second project notes\nDifferent research.')
  const firstDb = new Database(':memory:')
  const secondDb = new Database(':memory:')
  t.after(() => {
    firstDb.close()
    secondDb.close()
    rmSync(firstDirectory, { recursive: true, force: true })
    rmSync(secondDirectory, { recursive: true, force: true })
  })
  const first = createCoachStore(firstDb, curriculum(firstDirectory, 'First project'))
  const second = createCoachStore(secondDb, curriculum(secondDirectory, 'Second project'))
  for (const store of [first, second]) {
    store.initializeDatabase()
    store.syncSeedData()
  }
  assert.equal(first.getBootstrapData().project.title, 'First project')
  assert.equal(second.getBootstrapData().project.title, 'Second project')
  assert.equal(first.getResearchDocumentDetail('notes')!.title, 'Boundary notes')
  assert.equal(second.getResearchDocumentDetail('notes')!.title, 'Second project notes')
  assert.equal(first.getResearchDocumentDetail('notes')!.sourcePath, join(firstDirectory, 'notes.md'))
  assert.equal(first.getResearchDocumentDetail('missing'), null)
  assert.equal(first.getLessonDetail('missing'), null)

  first.updateLessonProgress('orientation', 'completed', 5)
  first.addLessonComment('orientation', 'Please explain this boundary in more depth.', 'want_more_depth')
  const { quiz } = first.getLessonDetail('orientation')!
  const result = first.submitQuizAnswers(quiz.id, [{
    questionId: quiz.questions[0].id, selectedOption: 'This one',
  }])
  assert.equal(result.score, 100)
  assert.equal(result.results[0].isCorrect, true)
  assert.equal(first.getBootstrapData().dashboard.completedLessons, 1)
  assert.equal(first.getBootstrapData().dashboard.followUpCount, 1)
  assert.equal(first.getBootstrapData().dashboard.attemptCount, 1)
  const untouched = second.getLessonDetail('orientation')!
  assert.equal(untouched.lesson.status, 'not_started')
  assert.equal(untouched.lesson.confidence, 1)
  assert.deepEqual(untouched.comments, [])
  assert.deepEqual(untouched.quiz.recentAttempts, [])
  assert.equal(second.getBootstrapData().dashboard.attemptCount, 0)
})

test('refreshing seed content preserves learner state and stable row identities across reopening', (t) => {
  const directory = researchFixture()
  const databasePath = join(directory, 'learner.sqlite')
  let connection = new Database(databasePath)
  t.after(() => {
    connection.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const options = curriculum(directory)
  let store = createCoachStore(connection, options)
  store.initializeDatabase()
  store.syncSeedData()
  store.updateLessonProgress('orientation', 'completed', 4)
  store.addLessonComment('orientation', 'This is my retained learner note.', 'clear')
  const before = store.getLessonDetail('orientation')!
  store.submitQuizAnswers(before.quiz.id, [{ questionId: before.quiz.questions[0].id, selectedOption: 'This one' }])
  store.submitQuizAnswers(before.quiz.id, [{ questionId: before.quiz.questions[0].id, selectedOption: 'Another one' }])

  connection.close()
  connection = new Database(databasePath)
  options.project.title = 'Refreshed project'
  options.lessons[0].title = 'Refreshed lesson'
  options.lessons[0].quizQuestions[0].explanation = 'A clearer explanation.'
  writeFileSync(join(directory, 'notes.md'), '# Updated notes\nUpdated research.')
  store = createCoachStore(connection, options)
  store.initializeDatabase()
  store.syncSeedData()
  store.syncSeedData()

  const after = store.getLessonDetail('orientation')!
  assert.equal(after.lesson.title, 'Refreshed lesson')
  assert.equal(after.lesson.status, 'completed')
  assert.equal(after.lesson.confidence, 4)
  assert.equal(after.lesson.completedAt, before.lesson.completedAt)
  assert.equal(after.lesson.quizAverage, 50)
  assert.equal(after.lesson.quizBest, 100)
  assert.deepEqual(after.comments, before.comments)
  assert.equal(after.quiz.id, before.quiz.id)
  assert.equal(after.quiz.questions[0].id, before.quiz.questions[0].id)
  assert.equal(after.quiz.questions[0].explanation, 'A clearer explanation.')
  assert.equal(after.quiz.recentAttempts.length, 2)
  assert.equal(store.getBootstrapData().project.title, 'Refreshed project')
  assert.equal(store.getBootstrapData().dashboard.attemptCount, 2)
  assert.equal(store.getBootstrapData().lessons.length, 1)
  assert.equal(store.getBootstrapData().researchDocuments.length, 1)
  assert.equal(store.getResearchDocumentDetail('notes')!.content, readFileSync(join(directory, 'notes.md'), 'utf8'))
  assert.equal((connection.prepare('SELECT COUNT(*) AS count FROM quiz_responses').get() as { count: number }).count, 2)
  assert.deepEqual(connection.pragma('foreign_key_check'), [])
})

test('failed research import rolls back seed changes and leaves the caller connection usable', (t) => {
  const directory = researchFixture()
  const connection = new Database(':memory:')
  t.after(() => {
    connection.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const store = createCoachStore(connection, curriculum(directory))
  store.initializeDatabase()
  store.syncSeedData()
  store.addLessonComment('orientation', 'Keep this note through a failed refresh.', 'unsure')
  const failingOptions = curriculum(join(directory, 'does-not-exist'), 'Must roll back')
  const failedStore = createCoachStore(connection, failingOptions)
  assert.throws(() => failedStore.syncSeedData(), /ENOENT/)
  assert.equal(store.getBootstrapData().project.title, 'Fixture project')
  assert.equal(store.getLessonDetail('orientation')!.comments.length, 1)
  assert.equal(connection.open, true)
  assert.equal(connection.inTransaction, false)
})

test('refresh retires missing curriculum, preserves history, and restores returning content', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-01T00:00:00Z') })
  const directory = researchFixture()
  const connection = new Database(':memory:')
  t.after(() => {
    connection.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const options = curriculum(directory)
  options.lessons[0].relatedResearchSlugs.push('removed')
  options.lessons[0].quizQuestions = [1, 2, 3].map((number) => ({
    prompt: `Question ${number}`, options: ['Right', 'Wrong'],
    correctOption: 'Right', explanation: `Reason ${number}`,
  }))
  const removedLesson = structuredClone(options.lessons[0])
  removedLesson.slug = 'removed-lesson'
  removedLesson.orderIndex = 2
  options.lessons.push(removedLesson)
  const removedPath = join(directory, 'removed.md')
  writeFileSync(removedPath, '# Removed research\nKeep the imported copy.')
  const store = createCoachStore(connection, options)
  store.initializeDatabase()
  store.syncSeedData()
  for (const lesson of options.lessons) {
    store.updateLessonProgress(lesson.slug, 'completed', 4)
    store.addLessonComment(lesson.slug, 'Keep this learner comment.', 'want_more_depth')
    const { quiz } = store.getLessonDetail(lesson.slug)!
    store.submitQuizAnswers(quiz.id, quiz.questions.map(({ id }) => ({
      questionId: id, selectedOption: lesson.slug === removedLesson.slug ? 'Wrong' : 'Right',
    })))
  }
  const before = store.getLessonDetail('orientation')!
  const removedBefore = store.getLessonDetail(removedLesson.slug)!
  const learnerSnapshot = () => ['lesson_progress', 'lesson_comments', 'quiz_attempts', 'quiz_responses']
    .map((table) => connection.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
  const history = learnerSnapshot()
  const removedQuestion = options.lessons[0].quizQuestions.pop()!
  options.lessons.pop()
  rmSync(removedPath)
  t.mock.timers.tick(1000)
  store.syncSeedData()

  const bootstrap = store.getBootstrapData()
  assert.deepEqual(bootstrap.lessons.map(({ slug }) => slug), ['orientation'])
  assert.deepEqual(bootstrap.researchDocuments.map(({ slug }) => slug), ['notes'])
  assert.equal(bootstrap.dashboard.totalLessons, 1)
  assert.equal(bootstrap.dashboard.completedLessons, 1)
  assert.equal(bootstrap.dashboard.nextRecommendedLesson, 'orientation')
  assert.equal(bootstrap.dashboard.attemptCount, 1)
  assert.equal(bootstrap.dashboard.averageQuizScore, 100)
  const refreshed = store.getLessonDetail('orientation')!
  assert.deepEqual(refreshed.quiz.questions.map(({ id }) => id), before.quiz.questions.slice(0, 2).map(({ id }) => id))
  assert.deepEqual(refreshed.relatedResearch.map(({ slug }) => slug), ['notes'])
  assert.deepEqual(learnerSnapshot(), history)
  assert.equal(store.getLessonDetail(removedLesson.slug)!.lesson.status, 'completed')
  assert.ok(store.getLessonDetail(removedLesson.slug)!.lesson.retiredAt)
  assert.deepEqual(store.getLessonDetail(removedLesson.slug)!.comments, removedBefore.comments)
  assert.deepEqual(store.getLessonDetail(removedLesson.slug)!.quiz.recentAttempts, removedBefore.quiz.recentAttempts)
  assert.deepEqual(store.getLessonDetail(removedLesson.slug)!.quiz.questions, [])
  assert.ok(store.getResearchDocumentDetail('removed')!.retiredAt)
  assert.match(store.getResearchDocumentDetail('removed')!.content, /Keep the imported copy/)
  assert.deepEqual(connection.prepare(`
    SELECT quiz_questions.prompt, quiz_responses.selected_option, quiz_responses.is_correct
    FROM quiz_responses JOIN quiz_questions ON quiz_questions.id = quiz_responses.question_id
    WHERE quiz_questions.id = ?
  `).all(before.quiz.questions[2].id), [{ prompt: 'Question 3', selected_option: 'Right', is_correct: 1 }])
  assert.throws(() => store.submitQuizAnswers(removedBefore.quiz.id, []), /Quiz not found/)
  assert.throws(() => store.submitQuizAnswers(before.quiz.id,
    before.quiz.questions.map(({ id }) => ({ questionId: id, selectedOption: 'Right' }))), /exactly once/)
  assert.throws(() => store.submitQuizAnswers(before.quiz.id, [
    { questionId: before.quiz.questions[0].id, selectedOption: 'Right' },
    { questionId: before.quiz.questions[2].id, selectedOption: 'Right' },
  ]), /exactly once/)
  assert.deepEqual(learnerSnapshot(), history)
  const result = store.submitQuizAnswers(before.quiz.id, refreshed.quiz.questions.map(({ id }, index) => ({
    questionId: id, selectedOption: index === 0 ? 'Right' : 'Wrong',
  })))
  assert.equal(result.totalQuestions, 2)
  assert.equal(result.score, 50)
  assert.equal(result.correctCount, 1)
  assert.equal(store.getBootstrapData().dashboard.attemptCount, 2)
  assert.equal(store.getBootstrapData().dashboard.averageQuizScore, 75)
  assert.equal(store.getLessonDetail('orientation')!.quiz.recentAttempts.find((attempt) => attempt.totalQuestions === 3)!.score, 100)

  const snapshot = () => ['projects', 'learning_tracks', 'lessons', 'research_documents', 'quizzes', 'quiz_questions']
    .map((table) => connection.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
    .concat(learnerSnapshot())
  const afterRefresh = snapshot()
  t.mock.timers.tick(1000)
  store.syncSeedData()
  assert.deepEqual(snapshot(), afterRefresh)

  // An empty curriculum retires everything; restoring seeds reuses all IDs.
  options.lessons.length = 0
  rmSync(join(directory, 'notes.md'))
  store.syncSeedData()
  assert.deepEqual(store.getBootstrapData().lessons, [])
  assert.deepEqual(store.getBootstrapData().researchDocuments, [])
  assert.equal(store.getBootstrapData().dashboard.attemptCount, 0)
  assert.equal(store.getBootstrapData().dashboard.averageQuizScore, 0)
  assert.throws(() => store.submitQuizAnswers(before.quiz.id, []), /Quiz not found/)
  const restoredLesson = curriculum(directory).lessons[0]
  restoredLesson.quizQuestions = [
    ...removedLesson.quizQuestions.slice(0, 2), removedQuestion,
  ]
  options.lessons.push(restoredLesson, removedLesson)
  writeFileSync(join(directory, 'notes.md'), '# Boundary notes\nOriginal research.')
  writeFileSync(removedPath, '# Removed research\nKeep the imported copy.')
  store.syncSeedData()
  const restored = store.getLessonDetail('orientation')!
  assert.equal(restored.lesson.retiredAt, null)
  assert.deepEqual(restored.quiz.questions.map(({ id }) => id), before.quiz.questions.map(({ id }) => id))
  assert.equal(store.getLessonDetail(removedLesson.slug)!.lesson.retiredAt, null)
  assert.deepEqual(store.getLessonDetail(removedLesson.slug)!.quiz, removedBefore.quiz)
  assert.equal(store.getResearchDocumentDetail('removed')!.retiredAt, null)
  assert.deepEqual(connection.pragma('foreign_key_check'), [])
})

test('initialization upgrades a populated legacy schema without changing learner rows', (t) => {
  const directory = researchFixture()
  const connection = new Database(':memory:')
  t.after(() => {
    connection.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const store = createCoachStore(connection, curriculum(directory))
  store.initializeDatabase()
  store.syncSeedData()
  store.addLessonComment('orientation', 'Keep this legacy learner note.', 'clear')
  const before = store.getLessonDetail('orientation')!
  store.submitQuizAnswers(before.quiz.id, [{ questionId: before.quiz.questions[0].id, selectedOption: 'This one' }])
  const history = connection.prepare('SELECT * FROM quiz_responses').all()
  // Recreate the pre-retirement layout, including populated foreign keys.
  for (const table of ['lessons', 'research_documents', 'quiz_questions']) {
    connection.exec(`ALTER TABLE ${table} DROP COLUMN retired_at`)
  }
  store.initializeDatabase()
  store.initializeDatabase()
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_responses').all(), history)
  assert.equal(store.getLessonDetail('orientation')!.lesson.retiredAt, null)
  assert.deepEqual(store.getLessonDetail('orientation')!.comments, before.comments)
  assert.equal(store.getLessonDetail('orientation')!.quiz.questions[0].id, before.quiz.questions[0].id)
  assert.equal(store.getLessonDetail('orientation')!.quiz.recentAttempts.length, 1)
  assert.deepEqual(connection.pragma('foreign_key_check'), [])
})

test('question identity follows unchanged prompts and replacements preserve original question history', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-01-01T00:00:00Z') })
  const directory = researchFixture()
  const connection = new Database(':memory:')
  t.after(() => {
    connection.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const options = curriculum(directory)
  options.lessons[0].quizQuestions.push({
    prompt: 'A second question', options: ['Yes', 'No'], correctOption: 'Yes', explanation: 'Reason',
  })
  const store = createCoachStore(connection, options)
  store.initializeDatabase()
  store.syncSeedData()
  const before = store.getLessonDetail('orientation')!
  store.submitQuizAnswers(before.quiz.id, before.quiz.questions.map(({ id, options }) => ({
    questionId: id, selectedOption: options[0],
  })))
  const history = connection.prepare('SELECT * FROM quiz_responses ORDER BY id').all()
  options.lessons[0].quizQuestions.reverse()
  store.syncSeedData()
  const reordered = store.getLessonDetail('orientation')!
  assert.deepEqual(reordered.quiz.questions.map(({ id }) => id), before.quiz.questions.map(({ id }) => id).reverse())
  assert.deepEqual(reordered.quiz.questions.map(({ prompt }) => prompt), before.quiz.questions.map(({ prompt }) => prompt).reverse())
  options.lessons[0].quizQuestions = [{
    prompt: 'What is an index?', options: ['A lookup structure', 'A table'],
    correctOption: 'A lookup structure', explanation: 'A new concept.',
  }]
  t.mock.timers.tick(1000)
  store.syncSeedData()
  const replacement = store.getLessonDetail('orientation')!.quiz.questions[0]
  assert.ok(before.quiz.questions.every(({ id }) => id !== replacement.id))
  assert.equal(replacement.prompt, 'What is an index?')
  assert.deepEqual(connection.prepare(`
    SELECT quiz_questions.id, quiz_questions.prompt, quiz_questions.options_json AS optionsJson,
      quiz_questions.order_index AS orderIndex, quiz_questions.retired_at AS retiredAt,
      quiz_responses.selected_option AS selectedOption
    FROM quiz_questions JOIN quiz_responses ON quiz_responses.question_id = quiz_questions.id
    ORDER BY quiz_questions.id
  `).all(), before.quiz.questions.map((question) => ({
    id: question.id, prompt: question.prompt, optionsJson: JSON.stringify(question.options),
    orderIndex: -question.id, retiredAt: '2026-01-01T00:00:01.000Z', selectedOption: question.options[0],
  })))
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_responses ORDER BY id').all(), history)
  assert.equal(store.getLessonDetail('orientation')!.quiz.recentAttempts[0].score, 100)
  const questions = connection.prepare('SELECT * FROM quiz_questions ORDER BY id').all()
  t.mock.timers.tick(1000)
  store.syncSeedData()
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_questions ORDER BY id').all(), questions)
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_responses ORDER BY id').all(), history)
})

test('duplicate prompts match distinct rows in ID order and remain stable across refreshes', (t) => {
  const directory = researchFixture()
  const connection = new Database(':memory:')
  t.after(() => {
    connection.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const options = curriculum(directory)
  const duplicate = options.lessons[0].quizQuestions[0]
  const other = {
    prompt: 'A different prompt', options: ['Yes', 'No'], correctOption: 'Yes', explanation: 'Reason',
  }
  options.lessons[0].quizQuestions.push(structuredClone(duplicate), other)
  const store = createCoachStore(connection, options)
  store.initializeDatabase()
  store.syncSeedData()
  const before = store.getLessonDetail('orientation')!.quiz
  store.submitQuizAnswers(before.id, before.questions.map(({ id, options }) => ({
    questionId: id, selectedOption: options[0],
  })))
  const history = connection.prepare('SELECT * FROM quiz_responses ORDER BY id').all()
  options.lessons[0].quizQuestions = [other, duplicate, structuredClone(duplicate)]
  store.syncSeedData()
  assert.deepEqual(store.getLessonDetail('orientation')!.quiz.questions.map(({ id }) => id), [
    before.questions[2].id, before.questions[0].id, before.questions[1].id,
  ])
  const questions = connection.prepare('SELECT * FROM quiz_questions ORDER BY id').all()
  store.syncSeedData()
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_questions ORDER BY id').all(), questions)
  options.lessons[0].quizQuestions.pop()
  store.syncSeedData()
  assert.deepEqual(store.getLessonDetail('orientation')!.quiz.questions.map(({ id }) => id), [
    before.questions[2].id, before.questions[0].id,
  ])
  assert.ok((connection.prepare('SELECT retired_at FROM quiz_questions WHERE id = ?')
    .get(before.questions[1].id) as { retired_at: string | null }).retired_at)
  options.lessons[0].quizQuestions.push(structuredClone(duplicate))
  store.syncSeedData()
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_questions ORDER BY id').all(), questions)
  assert.deepEqual(connection.prepare('SELECT * FROM quiz_responses ORDER BY id').all(), history)
  assert.deepEqual(connection.pragma('foreign_key_check'), [])
})


test('the reusable store loads without sample project files or creating a data directory', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-coach-engine-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'server'))
  cpSync(new URL('../server/store.ts', import.meta.url), join(directory, 'server/store.ts'))
  symlinkSync(new URL('../node_modules', import.meta.url), join(directory, 'node_modules'), 'dir')
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}')
  const before = readdirSync(directory).sort()
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "import { createCoachStore } from './server/store.ts'; console.log(typeof createCoachStore)",
  ], { cwd: directory, encoding: 'utf8', timeout: 10_000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'function')
  assert.deepEqual(readdirSync(directory).sort(), before)
})
