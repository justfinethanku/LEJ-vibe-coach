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
