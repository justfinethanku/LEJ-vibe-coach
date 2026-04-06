import { startTransition, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import {
  addLessonComment,
  fetchBootstrap,
  fetchLessonDetail,
  fetchResearchDocument,
  saveLessonProgress,
  submitQuiz,
} from './lib/api'
import type {
  BootstrapData,
  LessonDetail,
  LessonStatus,
  QuizResult,
  ResearchDocumentDetail,
  UnderstandingState,
} from './lib/types'
import './App.css'

const confidenceLabels = ['Very shaky', 'Basic grasp', 'Can explain it', 'Mostly solid', 'Could teach it']

const noteLabels: Record<UnderstandingState, string> = {
  clear: 'I get it',
  unsure: 'I am unsure',
  confused: 'I am confused',
  want_more_depth: 'I want more depth',
  want_examples: 'I want examples',
}

const statusLabels: Record<LessonStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Not yet'

function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null)
  const [activeView, setActiveView] = useState<'lesson' | 'research'>('lesson')
  const [selectedLessonSlug, setSelectedLessonSlug] = useState<string | null>(null)
  const [selectedResearchSlug, setSelectedResearchSlug] = useState<string | null>(null)
  const [lessonDetail, setLessonDetail] = useState<LessonDetail | null>(null)
  const [researchDetail, setResearchDetail] = useState<ResearchDocumentDetail | null>(
    null,
  )
  const [lessonLoading, setLessonLoading] = useState(false)
  const [researchLoading, setResearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressStatus, setProgressStatus] = useState<LessonStatus>('not_started')
  const [confidence, setConfidence] = useState(1)
  const [savingProgress, setSavingProgress] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [understandingState, setUnderstandingState] =
    useState<UnderstandingState>('unsure')
  const [savingComment, setSavingComment] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [submittingQuiz, setSubmittingQuiz] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchBootstrap()
        setBootstrap(data)

        setSelectedLessonSlug((current) => current ?? data.dashboard.nextRecommendedLesson)
        setSelectedResearchSlug((current) => current ?? data.researchDocuments[0]?.slug ?? null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load app data.')
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedLessonSlug) {
      return
    }

    setLessonLoading(true)
    setError(null)

    void (async () => {
      try {
        const detail = await fetchLessonDetail(selectedLessonSlug)
        setLessonDetail(detail)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load lesson.')
      } finally {
        setLessonLoading(false)
      }
    })()
  }, [selectedLessonSlug])

  useEffect(() => {
    if (!selectedResearchSlug || activeView !== 'research') {
      return
    }

    setResearchLoading(true)
    setError(null)

    void (async () => {
      try {
        const detail = await fetchResearchDocument(selectedResearchSlug)
        setResearchDetail(detail)
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load research document.',
        )
      } finally {
        setResearchLoading(false)
      }
    })()
  }, [selectedResearchSlug, activeView])

  const lessonSlug = lessonDetail?.lesson.slug
  const lessonConfidence = lessonDetail?.lesson.confidence ?? 1
  const lessonStatus = lessonDetail?.lesson.status ?? 'not_started'

  useEffect(() => {
    if (!lessonSlug) {
      return
    }

    setProgressStatus(lessonStatus)
    setConfidence(lessonConfidence)
    setCommentBody('')
    setUnderstandingState('unsure')
    setQuizAnswers({})
    setQuizResult(null)
  }, [lessonConfidence, lessonSlug, lessonStatus])

  const selectedLessonSummary =
    bootstrap?.lessons.find((lesson) => lesson.slug === selectedLessonSlug) ?? null

  const refreshLessonAndDashboard = async (slug: string) => {
    const [data, detail] = await Promise.all([fetchBootstrap(), fetchLessonDetail(slug)])
    setBootstrap(data)
    setLessonDetail(detail)
  }

  const handleLessonSelect = (slug: string) => {
    startTransition(() => {
      setActiveView('lesson')
      setSelectedLessonSlug(slug)
    })
  }

  const handleResearchSelect = (slug: string) => {
    startTransition(() => {
      setActiveView('research')
      setSelectedResearchSlug(slug)
    })
  }

  const handleSaveProgress = async () => {
    if (!lessonDetail) {
      return
    }

    setSavingProgress(true)
    setError(null)

    try {
      await saveLessonProgress(lessonDetail.lesson.slug, progressStatus, confidence)
      await refreshLessonAndDashboard(lessonDetail.lesson.slug)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save progress.')
    } finally {
      setSavingProgress(false)
    }
  }

  const handleSaveComment = async () => {
    if (!lessonDetail || commentBody.trim().length < 10) {
      return
    }

    setSavingComment(true)
    setError(null)

    try {
      await addLessonComment(
        lessonDetail.lesson.slug,
        commentBody.trim(),
        understandingState,
      )
      await refreshLessonAndDashboard(lessonDetail.lesson.slug)
      setCommentBody('')
      setUnderstandingState('unsure')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save note.')
    } finally {
      setSavingComment(false)
    }
  }

  const handleQuizSubmit = async () => {
    if (!lessonDetail) {
      return
    }

    const answers = lessonDetail.quiz.questions.map((question) => ({
      questionId: question.id,
      selectedOption: quizAnswers[question.id] ?? '',
    }))

    if (answers.some((answer) => answer.selectedOption.length === 0)) {
      setError('Answer every quiz question before submitting.')
      return
    }

    setSubmittingQuiz(true)
    setError(null)

    try {
      const result = await submitQuiz(lessonDetail.quiz.id, answers)
      setQuizResult(result)
      await refreshLessonAndDashboard(lessonDetail.lesson.slug)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit quiz.')
    } finally {
      setSubmittingQuiz(false)
    }
  }

  const progressPercent = bootstrap
    ? Math.round((bootstrap.dashboard.completedLessons / bootstrap.dashboard.totalLessons) * 100)
    : 0

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__header">
          <p className="eyebrow">The educational platform that teaches you while you build</p>
          <h1>Vibe Coach</h1>
          <p className="sidebar__copy">
            Research lives in SQLite. Lessons, notes, quizzes, and learner feedback build on top of it.
          </p>
        </div>

        <section className="sidebar__section">
          <div className="sidebar__section-title">
            <span>Lesson path</span>
            <span>{bootstrap?.dashboard.completedLessons ?? 0}/{bootstrap?.dashboard.totalLessons ?? 0}</span>
          </div>
          <div className="sidebar__list">
            {bootstrap?.lessons.map((lesson) => (
              <button
                key={lesson.slug}
                className={`nav-card ${selectedLessonSlug === lesson.slug && activeView === 'lesson' ? 'is-active' : ''}`}
                onClick={() => handleLessonSelect(lesson.slug)}
                type="button"
              >
                <div className="nav-card__topline">
                  <span>{lesson.orderIndex}. {lesson.title}</span>
                  <span className={`status-pill status-${lesson.status}`}>{statusLabels[lesson.status]}</span>
                </div>
                <p>{lesson.summary}</p>
                <div className="nav-card__meta">
                  <span>{lesson.stage}</span>
                  <span>{lesson.estimatedMinutes} min</span>
                  <span>Best {lesson.quizBest}%</span>
                  {lesson.followUpCount > 0 ? <span>{lesson.followUpCount} follow-up</span> : null}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar__section">
          <div className="sidebar__section-title">
                    <span>Research library</span>
                    <span>{bootstrap?.researchDocuments.length ?? 0} docs</span>
          </div>
          <div className="sidebar__list sidebar__list--compact">
            {bootstrap?.researchDocuments.map((document) => (
              <button
                key={document.slug}
                className={`nav-card nav-card--compact ${selectedResearchSlug === document.slug && activeView === 'research' ? 'is-active' : ''}`}
                onClick={() => handleResearchSelect(document.slug)}
                type="button"
              >
                <strong>{document.title}</strong>
                <p>{document.summary}</p>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="main-panel">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Current curriculum</p>
            <h2>{bootstrap?.project.title ?? 'Loading...'}</h2>
            <p className="hero-panel__copy">
              {bootstrap?.project.description ??
                'Seeding project research, lessons, notes, and quizzes from SQLite.'}
            </p>
          </div>

          <div className="hero-panel__stats">
            <MetricCard label="Progress" value={`${progressPercent}%`} />
            <MetricCard
              label="Avg quiz"
              value={`${bootstrap?.dashboard.averageQuizScore ?? 0}%`}
            />
            <MetricCard
              label="Attempts"
              value={String(bootstrap?.dashboard.attemptCount ?? 0)}
            />
            <MetricCard
              label="Follow-ups"
              value={String(bootstrap?.dashboard.followUpCount ?? 0)}
            />
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="view-toggle">
          <button
            className={activeView === 'lesson' ? 'is-selected' : ''}
            onClick={() => setActiveView('lesson')}
            type="button"
          >
            Learning studio
          </button>
          <button
            className={activeView === 'research' ? 'is-selected' : ''}
            onClick={() => setActiveView('research')}
            type="button"
          >
            Research vault
          </button>
        </div>

        {activeView === 'lesson' ? (
          lessonLoading || !lessonDetail ? (
            <PanelLoader label="Loading lesson..." />
          ) : (
            <div className="content-grid">
              <section className="content-card">
                <div className="lesson-header">
                  <div>
                    <p className="eyebrow">
                      Lesson {lessonDetail.lesson.orderIndex} · {lessonDetail.lesson.stage}
                    </p>
                    <h3>{lessonDetail.lesson.title}</h3>
                    <p className="content-card__summary">{lessonDetail.lesson.summary}</p>
                  </div>

                  <div className="lesson-header__badges">
                    <span className={`status-pill status-${lessonDetail.lesson.status}`}>
                      {statusLabels[lessonDetail.lesson.status]}
                    </span>
                    <span className="meta-pill">{lessonDetail.lesson.difficulty}</span>
                    <span className="meta-pill">{lessonDetail.lesson.estimatedMinutes} min</span>
                  </div>
                </div>

                <div className="goal-list">
                  {lessonDetail.lesson.goals.map((goal) => (
                    <div key={goal} className="goal-pill">
                      {goal}
                    </div>
                  ))}
                </div>

                <div className="markdown-body">
                  <ReactMarkdown>{lessonDetail.lesson.content}</ReactMarkdown>
                </div>
              </section>

              <section className="side-column">
                <article className="content-card">
                  <div className="section-heading">
                    <h4>Progress</h4>
                    <span className="muted">
                      Last viewed {formatDate(lessonDetail.lesson.lastViewedAt)}
                    </span>
                  </div>

                  <div className="status-controls">
                    {(['not_started', 'in_progress', 'completed'] as LessonStatus[]).map((status) => (
                      <button
                        key={status}
                        className={progressStatus === status ? 'is-selected' : ''}
                        onClick={() => setProgressStatus(status)}
                        type="button"
                      >
                        {statusLabels[status]}
                      </button>
                    ))}
                  </div>

                  <div className="confidence-scale">
                    <div className="section-heading">
                      <h5>Confidence</h5>
                      <span className="muted">{confidenceLabels[confidence - 1]}</span>
                    </div>
                    <div className="confidence-buttons">
                      {confidenceLabels.map((label, index) => (
                        <button
                          key={label}
                          className={confidence === index + 1 ? 'is-selected' : ''}
                          onClick={() => setConfidence(index + 1)}
                          type="button"
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    disabled={savingProgress}
                    onClick={handleSaveProgress}
                    type="button"
                  >
                    {savingProgress ? 'Saving...' : 'Save progress'}
                  </button>
                </article>

                <article className="content-card">
                  <div className="section-heading">
                    <h4>{lessonDetail.quiz.title}</h4>
                    <span className="muted">
                      Target score {lessonDetail.quiz.passingScore}%
                    </span>
                  </div>

                  <div className="quiz-list">
                    {lessonDetail.quiz.questions.map((question) => (
                      <fieldset key={question.id} className="quiz-question">
                        <legend>
                          {question.orderIndex}. {question.prompt}
                        </legend>
                        {question.options.map((option) => (
                          <label key={option} className="quiz-option">
                            <input
                              checked={quizAnswers[question.id] === option}
                              name={`question-${question.id}`}
                              onChange={() =>
                                setQuizAnswers((current) => ({
                                  ...current,
                                  [question.id]: option,
                                }))
                              }
                              type="radio"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                        {quizResult ? (
                          <div className="quiz-feedback">
                            <strong>
                              {
                                quizResult.results.find((result) => result.questionId === question.id)
                                  ?.correctOption
                              }
                            </strong>
                            <p>{question.explanation}</p>
                          </div>
                        ) : null}
                      </fieldset>
                    ))}
                  </div>

                  <button
                    className="primary-button"
                    disabled={submittingQuiz}
                    onClick={handleQuizSubmit}
                    type="button"
                  >
                    {submittingQuiz ? 'Submitting...' : 'Submit quiz'}
                  </button>

                  {quizResult ? (
                    <div className="result-panel">
                      <div className="result-panel__score">
                        <span>{quizResult.score}%</span>
                        <small>
                          {quizResult.correctCount}/{quizResult.totalQuestions} correct
                        </small>
                      </div>
                      <div className="result-panel__meta">
                        <span>Best score {lessonDetail.lesson.quizBest}%</span>
                        <span>Average {lessonDetail.lesson.quizAverage}%</span>
                      </div>
                    </div>
                  ) : null}
                </article>

                <article className="content-card">
                  <div className="section-heading">
                    <h4>Lesson notes</h4>
                    <span className="muted">These are the teaching signals for future revisions.</span>
                  </div>

                  <label className="field">
                    <span>How did this land?</span>
                    <select
                      onChange={(event) =>
                        setUnderstandingState(event.target.value as UnderstandingState)
                      }
                      value={understandingState}
                    >
                      {Object.entries(noteLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Write what clicked or what did not.</span>
                    <textarea
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder="Example: I understand why the host owns permissions, but I still need a simpler example of session state versus workflow state."
                      rows={6}
                      value={commentBody}
                    />
                  </label>

                  <button
                    className="primary-button"
                    disabled={savingComment || commentBody.trim().length < 10}
                    onClick={handleSaveComment}
                    type="button"
                  >
                    {savingComment ? 'Saving...' : 'Save note'}
                  </button>

                  <div className="note-list">
                    {lessonDetail.comments.length === 0 ? (
                      <p className="empty-state">No notes yet for this lesson.</p>
                    ) : (
                      lessonDetail.comments.map((comment) => (
                        <article key={comment.id} className="note-card">
                          <div className="note-card__header">
                            <span className={`note-state note-${comment.understandingState}`}>
                              {noteLabels[comment.understandingState]}
                            </span>
                            <small>{formatDate(comment.createdAt)}</small>
                          </div>
                          <p>{comment.body}</p>
                        </article>
                      ))
                    )}
                  </div>
                </article>

                <article className="content-card">
                  <div className="section-heading">
                    <h4>Related research</h4>
                    <span className="muted">Open the underlying source notes at any time.</span>
                  </div>

                  <div className="related-list">
                    {lessonDetail.relatedResearch.map((document) => (
                      <button
                        key={document.slug}
                        className="related-card"
                        onClick={() => handleResearchSelect(document.slug)}
                        type="button"
                      >
                        <strong>{document.title}</strong>
                        <p>{document.summary}</p>
                      </button>
                    ))}
                  </div>
                </article>
              </section>
            </div>
          )
        ) : researchLoading || !researchDetail ? (
          <PanelLoader label="Loading research..." />
        ) : (
          <section className="content-card content-card--wide">
            <div className="lesson-header">
              <div>
                <p className="eyebrow">Research library · {researchDetail.category}</p>
                <h3>{researchDetail.title}</h3>
                <p className="content-card__summary">{researchDetail.summary}</p>
              </div>

              {selectedLessonSummary ? (
                <button
                  className="secondary-button"
                  onClick={() => handleLessonSelect(selectedLessonSummary.slug)}
                  type="button"
                >
                  Back to lesson
                </button>
              ) : null}
            </div>

            <div className="research-meta">
              <span className="meta-pill">{researchDetail.sourcePath}</span>
            </div>

            <div className="markdown-body">
              <ReactMarkdown>{researchDetail.content}</ReactMarkdown>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PanelLoader({ label }: { label: string }) {
  return (
    <div className="panel-loader">
      <div className="panel-loader__pulse" />
      <p>{label}</p>
    </div>
  )
}

export default App
