export type LessonStatus = 'not_started' | 'in_progress' | 'completed'

export type UnderstandingState =
  | 'clear'
  | 'unsure'
  | 'confused'
  | 'want_more_depth'
  | 'want_examples'

export type LessonSummary = {
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
}

export type ResearchDocumentSummary = {
  slug: string
  title: string
  summary: string
  category: string
}

export type BootstrapData = {
  project: {
    slug: string
    title: string
    description: string
  }
  dashboard: {
    totalLessons: number
    completedLessons: number
    averageQuizScore: number
    attemptCount: number
    followUpCount: number
    nextRecommendedLesson: string
  }
  lessons: LessonSummary[]
  researchDocuments: ResearchDocumentSummary[]
}

export type LessonDetail = {
  lesson: {
    slug: string
    title: string
    stage: string
    difficulty: string
    orderIndex: number
    estimatedMinutes: number
    summary: string
    goals: string[]
    content: string
    status: LessonStatus
    confidence: number
    quizAverage: number
    quizBest: number
    lastViewedAt: string | null
    completedAt: string | null
  }
  quiz: {
    id: number
    title: string
    passingScore: number
    questions: Array<{
      id: number
      orderIndex: number
      prompt: string
      options: string[]
      explanation: string
    }>
    recentAttempts: Array<{
      id: number
      score: number
      totalQuestions: number
      createdAt: string
    }>
  }
  comments: Array<{
    id: number
    body: string
    understandingState: UnderstandingState
    createdAt: string
  }>
  relatedResearch: ResearchDocumentSummary[]
}

export type ResearchDocumentDetail = {
  slug: string
  title: string
  summary: string
  category: string
  content: string
  sourcePath: string
  sourceUrl: string | null
}

export type QuizResult = {
  score: number
  totalQuestions: number
  correctCount: number
  results: Array<{
    questionId: number
    prompt: string
    selectedOption: string
    correctOption: string
    explanation: string
    isCorrect: boolean
  }>
}
