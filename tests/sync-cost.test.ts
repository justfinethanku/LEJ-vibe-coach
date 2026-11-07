import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createCoachStore, type CoachStoreOptions } from '../server/store.js'

test('refresh and reopen writes stay bounded as retired grading history grows', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'coach-sync-cost-'))
  const researchDirectory = join(root, 'research')
  mkdirSync(researchDirectory)
  const path = join(root, 'learner.sqlite')
  let db = new Database(path)
  t.after(() => {
    db.close()
    rmSync(root, { recursive: true, force: true })
  })
  const options: CoachStoreOptions = {
    project: { slug: 'fixture', title: 'Fixture', description: 'Fixture' },
    track: { slug: 'basics', title: 'Basics', description: 'Basics' },
    researchDirectory, researchMetadata: {},
    lessons: [{
      slug: 'first', title: 'First', stage: 'Foundations', difficulty: 'Intro',
      orderIndex: 1, estimatedMinutes: 5, summary: 'Fixture', goals: [],
      relatedResearchSlugs: [], content: '## Lesson', quizTitle: 'Quiz',
      quizQuestions: [{
        prompt: 'Which version?', options: ['Current', 'Other'],
        correctOption: 'Current', explanation: 'Current grading.',
      }],
    }],
  }
  let store = createCoachStore(db, options)
  store.initializeDatabase()
  store.syncSeedData()
  store.addLessonComment('first', 'Keep learner history through refresh.', 'clear')
  const before = store.getLessonDetail('first')!
  store.submitQuizAnswers(before.quiz.id, [{
    questionId: before.quiz.questions[0].id, selectedOption: 'Current',
  }])
  const learnerHistory = () => ['lesson_progress', 'lesson_comments', 'quiz_attempts', 'quiz_responses']
    .map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
  const retainedLearner = learnerHistory()
  const refreshChanges = () => {
    const start = (db.prepare('SELECT total_changes() AS count').get() as { count: number }).count
    store.syncSeedData()
    return (db.prepare('SELECT total_changes() AS count').get() as { count: number }).count - start
  }
  const smallRefreshChanges = refreshChanges()

  // Legal retired versions with the same prompt/key but different choices.
  // They model retained curriculum revisions, not extra active questions.
  for (const added of [100, 1_000]) {
    db.transaction(() => {
      const insert = db.prepare(`INSERT INTO quiz_questions
        (quiz_id, order_index, prompt, options_json, correct_option, explanation, retired_at)
        VALUES (?, ?, ?, ?, 'Current', 'Historical grading.', '2025-01-01T00:00:00Z')`)
      for (let i = 0; i < added; i++) {
        const id = (db.prepare('SELECT MAX(id) + 1 AS id FROM quiz_questions').get() as { id: number }).id
        insert.run(before.quiz.id, -id, 'Which version?', JSON.stringify(['Current', `Version ${id}`]))
      }
    })()
    const historicalRows = () => db.prepare('SELECT * FROM quiz_questions WHERE order_index < 0 ORDER BY id').all()
    const retainedQuestions = historicalRows()
    db.close()
    db = new Database(path)
    store = createCoachStore(db, options)
    store.initializeDatabase()
    store.initializeDatabase()
    for (let retry = 0; retry < 2; retry++) {
      assert.equal(refreshChanges(), smallRefreshChanges,
        'unchanged refresh must not rewrite accumulated historical versions')
      assert.deepEqual(historicalRows(), retainedQuestions)
      assert.deepEqual(learnerHistory(), retainedLearner)
      assert.equal(store.getLessonDetail('first')!.quiz.questions[0].id, before.quiz.questions[0].id)
    }
    assert.deepEqual(db.pragma('foreign_key_check'), [])
  }
})
