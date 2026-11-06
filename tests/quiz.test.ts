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
  const directory = mkdtempSync(join(tmpdir(), 'vibe-coach-quiz-'))
  const db = new Database(':memory:')
  t.after(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const options: CoachStoreOptions = {
    project: { slug: 'quiz-fixture', title: 'Quiz fixture', description: 'Learner behavior' },
    track: { slug: 'basics', title: 'Basics', description: 'Start here' },
    researchDirectory: directory,
    researchMetadata: {},
    lessons: ['first', 'second'].map((slug, index) => ({
      slug, title: slug, stage: 'Foundations', difficulty: 'Intro', orderIndex: index + 1,
      estimatedMinutes: 5, summary: 'Learn by reasoning', goals: [], content: 'Lesson',
      relatedResearchSlugs: [], quizTitle: `${slug} quiz`,
      quizQuestions: [1, 2, 3].map((number) => ({
        prompt: `${slug} question ${number}`, options: [`Right ${number}`, `Wrong ${number}`],
        correctOption: `Right ${number}`, explanation: `Reason ${number}`,
      })),
    })),
  }
  const store = createCoachStore(db, options)
  store.initializeDatabase()
  store.syncSeedData()
  const detail = store.getLessonDetail('first')!
  const answers = detail.quiz.questions.map((question, index) => ({
    questionId: question.id, selectedOption: `Right ${index + 1}`,
  }))
  return { db, store, detail, answers }
}

test('invalid quiz answers leave attempts, responses, progress and dashboard unchanged', async (t) => {
  for (const invalid of ['empty', 'missing', 'duplicate', 'foreign', 'unknown', 'blank', 'invalid option', 'unknown quiz']) {
    await t.test(invalid, (t) => {
      const { db, store, detail, answers } = fixture(t)
      // Include existing history so rejection cannot silently replace or erase it.
      store.submitQuizAnswers(detail.quiz.id, answers)
      const before = {
        lesson: store.getLessonDetail('first'), dashboard: store.getBootstrapData().dashboard,
        attempts: db.prepare('SELECT * FROM quiz_attempts').all(),
        responses: db.prepare('SELECT * FROM quiz_responses').all(),
      }
      let submitted = answers.map((answer) => ({ ...answer }))
      let quizId = detail.quiz.id
      switch (invalid) {
        case 'empty': submitted = []; break
        case 'missing': submitted.pop(); break
        case 'duplicate': submitted[2] = { ...submitted[0] }; break
        case 'foreign': submitted[2].questionId = store.getLessonDetail('second')!.quiz.questions[0].id; break
        case 'unknown': submitted[2].questionId = 999_999; break
        case 'blank': submitted[2].selectedOption = ''; break
        case 'invalid option': submitted[2].selectedOption = 'Not an offered choice'; break
        case 'unknown quiz': quizId = 999_999; break
      }
      assert.throws(() => store.submitQuizAnswers(quizId, submitted),
        invalid === 'unknown quiz' ? /Quiz not found/ : /answer|option/i)
      assert.deepEqual({
        lesson: store.getLessonDetail('first'), dashboard: store.getBootstrapData().dashboard,
        attempts: db.prepare('SELECT * FROM quiz_attempts').all(),
        responses: db.prepare('SELECT * FROM quiz_responses').all(),
      }, before)
      assert.equal(db.inTransaction, false)
    })
  }
})

test('grading matches question IDs and updates rounded averages, best scores and learner status', (t) => {
  const { db, store, detail, answers } = fixture(t)
  const mixed = answers.map((answer, index) => ({
    ...answer, selectedOption: index === 1 ? 'Wrong 2' : answer.selectedOption,
  })).reverse()
  const result = store.submitQuizAnswers(detail.quiz.id, mixed)
  assert.equal(result.score, 67)
  assert.equal(result.correctCount, 2)
  assert.equal(result.totalQuestions, 3)
  assert.deepEqual(result.results.map(({ questionId, selectedOption, correctOption, explanation, isCorrect }) =>
    ({ questionId, selectedOption, correctOption, explanation, isCorrect })),
  answers.map((answer, index) => ({
    questionId: answer.questionId, selectedOption: index === 1 ? 'Wrong 2' : answer.selectedOption,
    correctOption: answer.selectedOption, explanation: `Reason ${index + 1}`, isCorrect: index !== 1,
  })))
  assert.equal(store.getLessonDetail('first')!.lesson.status, 'in_progress')
  assert.equal(store.getLessonDetail('second')!.lesson.status, 'not_started')

  store.updateLessonProgress('first', 'completed', 4)
  const completedAt = store.getLessonDetail('first')!.lesson.completedAt
  store.submitQuizAnswers(detail.quiz.id, answers.map((answer, index) => ({
    ...answer, selectedOption: `Wrong ${index + 1}`,
  })))
  store.submitQuizAnswers(detail.quiz.id, answers)
  const after = store.getLessonDetail('first')!
  assert.equal(after.lesson.status, 'completed')
  assert.equal(after.lesson.confidence, 4)
  assert.equal(after.lesson.completedAt, completedAt)
  assert.equal(after.lesson.quizAverage, 56) // rounded mean of 67, 0, 100
  assert.equal(after.lesson.quizBest, 100)
  assert.equal(after.quiz.recentAttempts.length, 3)
  assert.deepEqual(store.getBootstrapData().dashboard, {
    totalLessons: 2, completedLessons: 1, averageQuizScore: 56,
    attemptCount: 3, followUpCount: 0, nextRecommendedLesson: 'second',
  })
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM quiz_responses').get() as { count: number }).count, 9)
  assert.deepEqual(db.pragma('foreign_key_check'), [])
})

test('a failed response write rolls back the whole quiz and a later retry succeeds', (t) => {
  const { db, store, detail, answers } = fixture(t)
  const before = store.getLessonDetail('first')
  // Fail after the first response: the attempt and prior response must roll back too.
  db.exec(`CREATE TRIGGER fail_response BEFORE INSERT ON quiz_responses
    WHEN NEW.question_id = ${answers[1].questionId}
    BEGIN SELECT RAISE(ABORT, 'fixture response failure'); END;`)
  assert.throws(() => store.submitQuizAnswers(detail.quiz.id, answers), /fixture response failure/)
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM quiz_attempts').get() as { count: number }).count, 0)
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM quiz_responses').get() as { count: number }).count, 0)
  assert.deepEqual(store.getLessonDetail('first'), before)
  assert.equal(store.getBootstrapData().dashboard.attemptCount, 0)
  assert.equal(db.inTransaction, false)
  db.exec('DROP TRIGGER fail_response')
  assert.equal(store.submitQuizAnswers(detail.quiz.id, answers).score, 100)
  assert.equal(store.getBootstrapData().dashboard.attemptCount, 1)
})
