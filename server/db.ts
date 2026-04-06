import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

import {
  LEARNING_TRACK_SEED,
  LESSON_SEEDS,
  PROJECT_SEED,
  RESEARCH_METADATA_BY_FILE,
} from './content.js'
import { DATA_DIR, DB_PATH, RESEARCH_DIR } from './paths.js'

type LessonStatus = 'not_started' | 'in_progress' | 'completed'
type UnderstandingState =
  | 'clear'
  | 'unsure'
  | 'confused'
  | 'want_more_depth'
  | 'want_examples'

mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const now = () => new Date().toISOString()

const slugFromFileName = (fileName: string) =>
  basename(fileName, extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const titleFromMarkdown = (content: string, fallback: string) => {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

const parseJson = <T>(value: string) => JSON.parse(value) as T

const getProjectId = () =>
  (
    db.prepare('SELECT id FROM projects WHERE slug = ?').get(PROJECT_SEED.slug) as {
      id: number
    }
  ).id

const getTrackId = () =>
  (
    db.prepare('SELECT id FROM learning_tracks WHERE slug = ?').get(
      LEARNING_TRACK_SEED.slug,
    ) as { id: number }
  ).id

const getLessonId = (slug: string) =>
  (db.prepare('SELECT id FROM lessons WHERE slug = ?').get(slug) as { id: number })
    .id

const getQuizId = (lessonId: number) =>
  (
    db.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').get(lessonId) as {
      id: number
    }
  ).id

export const initializeDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      source_path TEXT NOT NULL UNIQUE,
      source_url TEXT,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      track_id INTEGER NOT NULL REFERENCES learning_tracks(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      stage TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      summary TEXT NOT NULL,
      goals_json TEXT NOT NULL,
      content TEXT NOT NULL,
      related_research_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      passing_score INTEGER NOT NULL DEFAULT 70
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      explanation TEXT NOT NULL,
      UNIQUE (quiz_id, order_index)
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'not_started',
      confidence INTEGER NOT NULL DEFAULT 1,
      quiz_average INTEGER NOT NULL DEFAULT 0,
      quiz_best INTEGER NOT NULL DEFAULT 0,
      last_viewed_at TEXT,
      completed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quiz_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
      selected_option TEXT NOT NULL,
      is_correct INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lesson_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      understanding_state TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export const syncSeedData = () => {
  const timestamp = now()

  const sync = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO projects (slug, title, description, updated_at)
        VALUES (@slug, @title, @description, @updatedAt)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          updated_at = excluded.updated_at
      `,
    ).run({
      ...PROJECT_SEED,
      updatedAt: timestamp,
    })

    const projectId = getProjectId()

    db.prepare(
      `
        INSERT INTO learning_tracks (project_id, slug, title, description, order_index, updated_at)
        VALUES (@projectId, @slug, @title, @description, 1, @updatedAt)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          updated_at = excluded.updated_at
      `,
    ).run({
      projectId,
      ...LEARNING_TRACK_SEED,
      updatedAt: timestamp,
    })

    const trackId = getTrackId()

    const researchFiles = readdirSync(RESEARCH_DIR)
      .filter((fileName) => extname(fileName) === '.md')
      .sort()

    const upsertResearch = db.prepare(
      `
        INSERT INTO research_documents (
          project_id,
          slug,
          title,
          summary,
          category,
          content,
          source_path,
          source_url,
          content_hash,
          updated_at
        )
        VALUES (
          @projectId,
          @slug,
          @title,
          @summary,
          @category,
          @content,
          @sourcePath,
          @sourceUrl,
          @contentHash,
          @updatedAt
        )
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          category = excluded.category,
          content = excluded.content,
          source_path = excluded.source_path,
          source_url = excluded.source_url,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at
      `,
    )

    for (const fileName of researchFiles) {
      const sourcePath = resolve(RESEARCH_DIR, fileName)
      const content = readFileSync(sourcePath, 'utf8')
      const metadata = RESEARCH_METADATA_BY_FILE[fileName] ?? {
        summary: 'Imported research document.',
        category: 'reference',
      }

      upsertResearch.run({
        projectId,
        slug: slugFromFileName(fileName),
        title: titleFromMarkdown(content, basename(fileName, '.md')),
        summary: metadata.summary,
        category: metadata.category,
        content,
        sourcePath,
        sourceUrl: null,
        contentHash: createHash('sha1').update(content).digest('hex'),
        updatedAt: timestamp,
      })
    }

    const upsertLesson = db.prepare(
      `
        INSERT INTO lessons (
          project_id,
          track_id,
          slug,
          title,
          stage,
          difficulty,
          order_index,
          estimated_minutes,
          summary,
          goals_json,
          content,
          related_research_json,
          updated_at
        )
        VALUES (
          @projectId,
          @trackId,
          @slug,
          @title,
          @stage,
          @difficulty,
          @orderIndex,
          @estimatedMinutes,
          @summary,
          @goalsJson,
          @content,
          @relatedResearchJson,
          @updatedAt
        )
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          stage = excluded.stage,
          difficulty = excluded.difficulty,
          order_index = excluded.order_index,
          estimated_minutes = excluded.estimated_minutes,
          summary = excluded.summary,
          goals_json = excluded.goals_json,
          content = excluded.content,
          related_research_json = excluded.related_research_json,
          updated_at = excluded.updated_at
      `,
    )

    const upsertQuiz = db.prepare(
      `
        INSERT INTO quizzes (lesson_id, title, passing_score)
        VALUES (@lessonId, @title, 70)
        ON CONFLICT(lesson_id) DO UPDATE SET
          title = excluded.title,
          passing_score = excluded.passing_score
      `,
    )

    const upsertQuestion = db.prepare(
      `
        INSERT INTO quiz_questions (
          quiz_id,
          order_index,
          prompt,
          options_json,
          correct_option,
          explanation
        )
        VALUES (
          @quizId,
          @orderIndex,
          @prompt,
          @optionsJson,
          @correctOption,
          @explanation
        )
        ON CONFLICT(quiz_id, order_index) DO UPDATE SET
          prompt = excluded.prompt,
          options_json = excluded.options_json,
          correct_option = excluded.correct_option,
          explanation = excluded.explanation
      `,
    )

    const ensureProgress = db.prepare(
      `
        INSERT INTO lesson_progress (lesson_id, status, confidence, updated_at)
        VALUES (?, 'not_started', 1, ?)
        ON CONFLICT(lesson_id) DO NOTHING
      `,
    )

    for (const lesson of LESSON_SEEDS) {
      upsertLesson.run({
        projectId,
        trackId,
        slug: lesson.slug,
        title: lesson.title,
        stage: lesson.stage,
        difficulty: lesson.difficulty,
        orderIndex: lesson.orderIndex,
        estimatedMinutes: lesson.estimatedMinutes,
        summary: lesson.summary,
        goalsJson: JSON.stringify(lesson.goals),
        content: lesson.content,
        relatedResearchJson: JSON.stringify(lesson.relatedResearchSlugs),
        updatedAt: timestamp,
      })

      const lessonId = getLessonId(lesson.slug)
      upsertQuiz.run({
        lessonId,
        title: lesson.quizTitle,
      })

      const quizId = getQuizId(lessonId)
      lesson.quizQuestions.forEach((question, index) => {
        upsertQuestion.run({
          quizId,
          orderIndex: index + 1,
          prompt: question.prompt,
          optionsJson: JSON.stringify(question.options),
          correctOption: question.correctOption,
          explanation: question.explanation,
        })
      })

      ensureProgress.run(lessonId, timestamp)
    }
  })

  sync()
}

export const getBootstrapData = () => {
  const project = db.prepare(
    `
      SELECT slug, title, description
      FROM projects
      WHERE slug = ?
    `,
  ).get(PROJECT_SEED.slug) as {
    slug: string
    title: string
    description: string
  }

  const lessons = db.prepare(
    `
      SELECT
        lessons.slug,
        lessons.title,
        lessons.stage,
        lessons.difficulty,
        lessons.order_index AS orderIndex,
        lessons.estimated_minutes AS estimatedMinutes,
        lessons.summary,
        lesson_progress.status,
        lesson_progress.confidence,
        lesson_progress.quiz_average AS quizAverage,
        lesson_progress.quiz_best AS quizBest,
        (
          SELECT COUNT(*)
          FROM lesson_comments
          WHERE lesson_comments.lesson_id = lessons.id
            AND lesson_comments.understanding_state IN ('confused', 'want_more_depth', 'want_examples')
        ) AS followUpCount
      FROM lessons
      JOIN lesson_progress ON lesson_progress.lesson_id = lessons.id
      ORDER BY lessons.order_index
    `,
  ).all() as Array<{
    slug: string
    title: string
    stage: string
    difficulty: string
    orderIndex: number
    estimatedMinutes: number
    summary: string
    status: LessonStatus
    confidence: number
    quizAverage: number
    quizBest: number
    followUpCount: number
  }>

  const researchDocuments = db.prepare(
    `
      SELECT slug, title, summary, category
      FROM research_documents
      ORDER BY title
    `,
  ).all() as Array<{
    slug: string
    title: string
    summary: string
    category: string
  }>

  const attempts = db.prepare(
    `
      SELECT AVG(score) AS averageScore, COUNT(*) AS attemptCount
      FROM quiz_attempts
    `,
  ).get() as { averageScore: number | null; attemptCount: number }

  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed').length
  const followUpCount = lessons.reduce((sum, lesson) => sum + lesson.followUpCount, 0)
  const nextRecommendedLesson =
    lessons.find((lesson) => lesson.status !== 'completed')?.slug ?? lessons[0]?.slug

  return {
    project,
    dashboard: {
      totalLessons: lessons.length,
      completedLessons,
      averageQuizScore: attempts.averageScore ? Math.round(attempts.averageScore) : 0,
      attemptCount: attempts.attemptCount,
      followUpCount,
      nextRecommendedLesson,
    },
    lessons,
    researchDocuments,
  }
}

export const getLessonDetail = (slug: string) => {
  const lesson = db.prepare(
    `
      SELECT
        lessons.id,
        lessons.slug,
        lessons.title,
        lessons.stage,
        lessons.difficulty,
        lessons.order_index AS orderIndex,
        lessons.estimated_minutes AS estimatedMinutes,
        lessons.summary,
        lessons.goals_json AS goalsJson,
        lessons.content,
        lessons.related_research_json AS relatedResearchJson,
        lesson_progress.status,
        lesson_progress.confidence,
        lesson_progress.quiz_average AS quizAverage,
        lesson_progress.quiz_best AS quizBest,
        lesson_progress.last_viewed_at AS lastViewedAt,
        lesson_progress.completed_at AS completedAt,
        quizzes.id AS quizId,
        quizzes.title AS quizTitle,
        quizzes.passing_score AS passingScore
      FROM lessons
      JOIN lesson_progress ON lesson_progress.lesson_id = lessons.id
      JOIN quizzes ON quizzes.lesson_id = lessons.id
      WHERE lessons.slug = ?
    `,
  ).get(slug) as
    | {
        id: number
        slug: string
        title: string
        stage: string
        difficulty: string
        orderIndex: number
        estimatedMinutes: number
        summary: string
        goalsJson: string
        content: string
        relatedResearchJson: string
        status: LessonStatus
        confidence: number
        quizAverage: number
        quizBest: number
        lastViewedAt: string | null
        completedAt: string | null
        quizId: number
        quizTitle: string
        passingScore: number
      }
    | undefined

  if (!lesson) {
    return null
  }

  const questions = db.prepare(
    `
      SELECT id, order_index AS orderIndex, prompt, options_json AS optionsJson, explanation
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `,
  ).all(lesson.quizId) as Array<{
    id: number
    orderIndex: number
    prompt: string
    optionsJson: string
    explanation: string
  }>

  const comments = db.prepare(
    `
      SELECT id, body, understanding_state AS understandingState, created_at AS createdAt
      FROM lesson_comments
      WHERE lesson_id = ?
      ORDER BY created_at DESC
    `,
  ).all(lesson.id) as Array<{
    id: number
    body: string
    understandingState: UnderstandingState
    createdAt: string
  }>

  const recentAttempts = db.prepare(
    `
      SELECT id, score, total_questions AS totalQuestions, created_at AS createdAt
      FROM quiz_attempts
      WHERE quiz_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `,
  ).all(lesson.quizId) as Array<{
    id: number
    score: number
    totalQuestions: number
    createdAt: string
  }>

  const relatedResearchSlugs = parseJson<string[]>(lesson.relatedResearchJson)
  const relatedResearch =
    relatedResearchSlugs.length > 0
      ? (db
          .prepare(
            `
              SELECT slug, title, summary, category
              FROM research_documents
              WHERE slug IN (${relatedResearchSlugs.map(() => '?').join(', ')})
              ORDER BY title
            `,
          )
          .all(...relatedResearchSlugs) as Array<{
          slug: string
          title: string
          summary: string
          category: string
        }>)
      : []

  return {
    lesson: {
      slug: lesson.slug,
      title: lesson.title,
      stage: lesson.stage,
      difficulty: lesson.difficulty,
      orderIndex: lesson.orderIndex,
      estimatedMinutes: lesson.estimatedMinutes,
      summary: lesson.summary,
      goals: parseJson<string[]>(lesson.goalsJson),
      content: lesson.content,
      status: lesson.status,
      confidence: lesson.confidence,
      quizAverage: lesson.quizAverage,
      quizBest: lesson.quizBest,
      lastViewedAt: lesson.lastViewedAt,
      completedAt: lesson.completedAt,
    },
    quiz: {
      id: lesson.quizId,
      title: lesson.quizTitle,
      passingScore: lesson.passingScore,
      questions: questions.map((question) => ({
        id: question.id,
        orderIndex: question.orderIndex,
        prompt: question.prompt,
        options: parseJson<string[]>(question.optionsJson),
        explanation: question.explanation,
      })),
      recentAttempts,
    },
    comments,
    relatedResearch,
  }
}

export const getResearchDocumentDetail = (slug: string) => {
  const document = db.prepare(
    `
      SELECT slug, title, summary, category, content, source_path AS sourcePath, source_url AS sourceUrl
      FROM research_documents
      WHERE slug = ?
    `,
  ).get(slug) as
    | {
        slug: string
        title: string
        summary: string
        category: string
        content: string
        sourcePath: string
        sourceUrl: string | null
      }
    | undefined

  return document ?? null
}

export const updateLessonProgress = (
  slug: string,
  status: LessonStatus,
  confidence: number,
) => {
  const lessonId = getLessonId(slug)
  const timestamp = now()

  db.prepare(
    `
      UPDATE lesson_progress
      SET
        status = @status,
        confidence = @confidence,
        last_viewed_at = @lastViewedAt,
        completed_at = CASE WHEN @status = 'completed' THEN @completedAt ELSE completed_at END,
        updated_at = @updatedAt
      WHERE lesson_id = @lessonId
    `,
  ).run({
    lessonId,
    status,
    confidence,
    lastViewedAt: timestamp,
    completedAt: timestamp,
    updatedAt: timestamp,
  })

  return getLessonDetail(slug)
}

export const addLessonComment = (
  slug: string,
  body: string,
  understandingState: UnderstandingState,
) => {
  const lessonId = getLessonId(slug)
  db.prepare(
    `
      INSERT INTO lesson_comments (lesson_id, body, understanding_state)
      VALUES (?, ?, ?)
    `,
  ).run(lessonId, body, understandingState)

  db.prepare(
    `
      UPDATE lesson_progress
      SET
        last_viewed_at = ?,
        updated_at = ?
      WHERE lesson_id = ?
    `,
  ).run(now(), now(), lessonId)

  return getLessonDetail(slug)
}

export const submitQuizAnswers = (
  quizId: number,
  answers: Array<{ questionId: number; selectedOption: string }>,
) => {
  const questionRows = db.prepare(
    `
      SELECT id, prompt, correct_option AS correctOption, explanation
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `,
  ).all(quizId) as Array<{
    id: number
    prompt: string
    correctOption: string
    explanation: string
  }>

  if (questionRows.length === 0) {
    throw new Error('Quiz not found.')
  }

  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.selectedOption]))
  const results = questionRows.map((question) => {
    const selectedOption = answerMap.get(question.id) ?? ''
    const isCorrect = selectedOption === question.correctOption

    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedOption,
      correctOption: question.correctOption,
      explanation: question.explanation,
      isCorrect,
    }
  })

  const correctCount = results.filter((result) => result.isCorrect).length
  const score = Math.round((correctCount / questionRows.length) * 100)
  const timestamp = now()

  const writeAttempt = db.transaction(() => {
    const attemptResult = db.prepare(
      `
        INSERT INTO quiz_attempts (quiz_id, score, total_questions, created_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run(quizId, score, questionRows.length, timestamp)

    const attemptId = Number(attemptResult.lastInsertRowid)
    const insertResponse = db.prepare(
      `
        INSERT INTO quiz_responses (attempt_id, question_id, selected_option, is_correct)
        VALUES (?, ?, ?, ?)
      `,
    )

    for (const result of results) {
      insertResponse.run(
        attemptId,
        result.questionId,
        result.selectedOption,
        result.isCorrect ? 1 : 0,
      )
    }

    const lessonId = (
      db.prepare('SELECT lesson_id AS lessonId FROM quizzes WHERE id = ?').get(quizId) as {
        lessonId: number
      }
    ).lessonId

    const stats = db.prepare(
      `
        SELECT
          COALESCE(ROUND(AVG(score)), 0) AS quizAverage,
          COALESCE(MAX(score), 0) AS quizBest
        FROM quiz_attempts
        WHERE quiz_id = ?
      `,
    ).get(quizId) as { quizAverage: number; quizBest: number }

    db.prepare(
      `
        UPDATE lesson_progress
        SET
          quiz_average = @quizAverage,
          quiz_best = @quizBest,
          status = CASE
            WHEN status = 'not_started' THEN 'in_progress'
            ELSE status
          END,
          last_viewed_at = @lastViewedAt,
          updated_at = @updatedAt
        WHERE lesson_id = @lessonId
      `,
    ).run({
      lessonId,
      quizAverage: stats.quizAverage,
      quizBest: stats.quizBest,
      lastViewedAt: timestamp,
      updatedAt: timestamp,
    })
  })

  writeAttempt()

  return {
    score,
    totalQuestions: questionRows.length,
    correctCount,
    results,
  }
}

export const resetDatabase = () => {
  db.close()
  rmSync(DB_PATH, { force: true })
}

export { db }
