import express from 'express'
import { existsSync } from 'node:fs'
import { z } from 'zod'

import {
  addLessonComment,
  getBootstrapData,
  getLessonDetail,
  getResearchDocumentDetail,
  initializeDatabase,
  submitQuizAnswers,
  syncSeedData,
  updateLessonProgress,
} from './db.js'
import { DIST_DIR } from './paths.js'

const app = express()
const port = Number(process.env.PORT ?? 8787)

initializeDatabase()
syncSeedData()

app.use(express.json())

app.get('/api/bootstrap', (_request, response) => {
  response.json(getBootstrapData())
})

app.get('/api/lessons/:slug', (request, response) => {
  const detail = getLessonDetail(request.params.slug)

  if (!detail) {
    response.status(404).json({ error: 'Lesson not found.' })
    return
  }

  response.json(detail)
})

app.post('/api/lessons/:slug/progress', (request, response) => {
  const payload = z.object({
    status: z.enum(['not_started', 'in_progress', 'completed']),
    confidence: z.number().int().min(1).max(5),
  })

  const parsed = payload.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid lesson progress payload.' })
    return
  }

  const detail = updateLessonProgress(
    request.params.slug,
    parsed.data.status,
    parsed.data.confidence,
  )

  response.json(detail)
})

app.post('/api/lessons/:slug/comments', (request, response) => {
  const payload = z.object({
    body: z.string().trim().min(10).max(5000),
    understandingState: z.enum([
      'clear',
      'unsure',
      'confused',
      'want_more_depth',
      'want_examples',
    ]),
  })

  const parsed = payload.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid comment payload.' })
    return
  }

  const detail = addLessonComment(
    request.params.slug,
    parsed.data.body,
    parsed.data.understandingState,
  )

  response.json(detail)
})

app.post('/api/quizzes/:quizId/submit', (request, response) => {
  const payload = z.object({
    answers: z.array(
      z.object({
        questionId: z.number().int(),
        selectedOption: z.string().min(1),
      }),
    ),
  })

  const parsed = payload.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid quiz payload.' })
    return
  }

  try {
    const result = submitQuizAnswers(Number(request.params.quizId), parsed.data.answers)
    response.json(result)
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to submit quiz.',
    })
  }
})

app.get('/api/research/:slug', (request, response) => {
  const document = getResearchDocumentDetail(request.params.slug)

  if (!document) {
    response.status(404).json({ error: 'Research document not found.' })
    return
  }

  response.json(document)
})

if (process.env.NODE_ENV === 'production' && existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_request, response) => {
    response.sendFile('index.html', { root: DIST_DIR })
  })
}

app.listen(port, () => {
  console.log(`vibe-coach server listening on http://localhost:${port}`)
})
