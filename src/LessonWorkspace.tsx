import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { addLessonComment, fetchLessonDetail, saveLessonProgress, submitQuiz } from './lib/api'
import type { LessonDetail, LessonStatus, QuizResult, UnderstandingState } from './lib/types'
import PanelLoader from './PanelLoader'

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

// Imported Markdown sits below the lesson/research heading in the page outline.
const markdownHeadings = {
  h1: 'h3', h2: 'h3', h3: 'h4', h4: 'h5', h5: 'h6', h6: 'h6',
} as const

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Not yet'

type Props = {
  slug: string
  active: boolean
  focusRequest: number
  onResearchSelect: (slug: string) => void
  onDashboardRefresh: () => Promise<void>
}
type Action = 'progress' | 'note' | 'quiz'
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback
const quizIdentity = (detail: LessonDetail) => JSON.stringify([
  detail.quiz.id, detail.quiz.questions.map(({ id, options }) => [id, options]),
])

// App keys this owner by lesson slug. A navigation away ends this visit, so
// completions from that visit cannot publish into another lesson (even A → B → A).
export default function LessonWorkspace({ slug, active, focusRequest, onResearchSelect, onDashboardRefresh }: Props) {
  const [lessonDetail, setLessonDetail] = useState<LessonDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [quizNotice, setQuizNotice] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [progressStatus, setProgressStatus] = useState<LessonStatus>('not_started')
  const [confidence, setConfidence] = useState(1)
  const [commentBody, setCommentBody] = useState('')
  const [understandingState, setUnderstandingState] = useState<UnderstandingState>('unsure')
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const noteRevision = useRef(0)
  const progressRevision = useRef(0)
  const contentHeading = useRef<HTMLHeadingElement>(null)
  const lastFocusRequest = useRef(0)
  const loadPending = useRef(true)
  const focusAfterRetry = useRef(false)
  const quizHeading = useRef<HTMLHeadingElement>(null)
  const quizQuestions = useRef<HTMLDivElement>(null)
  const replacedFocus = useRef<Element | null>(null)

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void fetchLessonDetail(slug).then((detail) => {
      if (cancelled) return
      setLessonDetail(detail)
      setProgressStatus(detail.lesson.status)
      setConfidence(detail.lesson.confidence)
      if (focusAfterRetry.current) setAnnouncement('Lesson loaded.')
    }).catch((loadError) => {
      if (!cancelled) {
        setAnnouncement('')
        setError(message(loadError, 'Failed to load lesson.'))
      }
    }).finally(() => {
      if (!cancelled) {
        loadPending.current = false
        setLessonLoading(false)
      }
    })
    return () => { cancelled = true; mounted.current = false }
  }, [slug, loadAttempt])

  useEffect(() => {
    if (active && lessonDetail && (focusRequest > lastFocusRequest.current || focusAfterRetry.current)) {
      contentHeading.current?.focus()
      lastFocusRequest.current = focusRequest
      focusAfterRetry.current = false
    }
  }, [active, lessonDetail, focusRequest])

  useEffect(() => {
    const removed = replacedFocus.current
    // Move only focus lost with the old question; never interrupt another field
    // or bring a hidden lesson back from a research detour.
    if (active && removed && !removed.isConnected && document.activeElement === document.body) {
      quizHeading.current?.focus()
    }
    replacedFocus.current = null
  }, [active, lessonDetail])

  const retryLesson = () => {
    if (loadPending.current) return
    loadPending.current = true
    focusAfterRetry.current = true
    setLessonLoading(true)
    setError(null)
    setAnnouncement('Retrying lesson…')
    setLoadAttempt((current) => current + 1)
  }

  // Only an unchanged local draft adopts refreshed saved values. Quiz answers
  // and feedback belong to their exact set of question IDs, not just the slug.
  const publishDetail = (detail: LessonDetail, submittedProgressRevision: number) => {
    const quizChanged = lessonDetail !== null && quizIdentity(lessonDetail) !== quizIdentity(detail)
    if (quizChanged) {
      replacedFocus.current = quizQuestions.current?.contains(document.activeElement) ? document.activeElement : null
      setQuizAnswers({})
      setQuizResult(null)
      setQuizNotice('Quiz questions changed. Earlier answers and displayed results were cleared. Review the current questions before submitting again.')
    }
    setLessonDetail(detail)
    if (progressRevision.current === submittedProgressRevision) {
      setProgressStatus(detail.lesson.status)
      setConfidence(detail.lesson.confidence)
    }
    return quizChanged
  }

  const runAction = async (kind: Action, write: () => Promise<string>) => {
    if (pending.current || !lessonDetail) return
    pending.current = true
    setPendingAction(kind)
    setError(null)
    setAnnouncement(kind === 'quiz' ? 'Submitting quiz…' : kind === 'note' ? 'Saving note…' : 'Saving progress…')
    try {
      const saved = await write()
      if (mounted.current) setAnnouncement(saved)
      // An acknowledged write is final even if a later read fails. Refresh the
      // global dashboard independently; never invite replay of a committed note.
      try {
        await onDashboardRefresh()
      } catch (refreshError) {
        if (mounted.current) setError(`${saved} Dashboard refresh failed: ${message(refreshError, 'Request failed.')}`)
      }
    } catch (writeError) {
      if (mounted.current) {
        setAnnouncement('')
        setError(message(writeError, `Failed to save ${kind}.`))
      }
    } finally {
      pending.current = false
      if (mounted.current) setPendingAction(null)
    }
  }

  const handleSaveProgress = () => {
    if (!lessonDetail) return
    const revision = progressRevision.current
    void runAction('progress', async () => {
      const detail = await saveLessonProgress(slug, progressStatus, confidence)
      if (mounted.current) publishDetail(detail, revision)
      return 'Progress saved.'
    })
  }

  const handleSaveComment = () => {
    if (!lessonDetail || commentBody.trim().length < 10) return
    const submittedNoteRevision = noteRevision.current
    const submittedProgressRevision = progressRevision.current
    void runAction('note', async () => {
      const detail = await addLessonComment(slug, commentBody.trim(), understandingState)
      if (mounted.current) {
        publishDetail(detail, submittedProgressRevision)
        if (noteRevision.current === submittedNoteRevision) {
          setCommentBody('')
          setUnderstandingState('unsure')
        }
      }
      return 'Note saved.'
    })
  }

  const handleQuizSubmit = () => {
    if (!lessonDetail || pending.current) return
    const answers = lessonDetail.quiz.questions.map((question) => ({
      questionId: question.id, selectedOption: quizAnswers[question.id] ?? '',
    }))
    const missing = answers.find((answer) => !answer.selectedOption)
    if (missing) {
      setAnnouncement('')
      setError('Answer every quiz question before submitting.')
      document.querySelector<HTMLInputElement>(`input[name="question-${missing.questionId}"]`)?.focus()
      return
    }
    const revision = progressRevision.current
    void runAction('quiz', async () => {
      const result = await submitQuiz(lessonDetail.quiz.id, answers)
      let saved = `Quiz scored ${result.score}%. ${result.correctCount} of ${result.totalQuestions} correct.`
      if (mounted.current) {
        setQuizResult(result)
        setQuizNotice('')
      }
      try {
        const detail = await fetchLessonDetail(slug)
        if (mounted.current && publishDetail(detail, revision)) saved = `Previous ${saved.toLowerCase()}`
      } catch (refreshError) {
        if (mounted.current) setError(`${saved} Lesson refresh failed: ${message(refreshError, 'Request failed.')}`)
      }
      return saved
    })
  }

  const savingProgress = pendingAction === 'progress'
  const savingComment = pendingAction === 'note'
  const submittingQuiz = pendingAction === 'quiz'
  return (
    <div hidden={!active}>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      <p className="save-status" role="status" aria-atomic="true">{[announcement, quizNotice].filter(Boolean).join(' ')}</p>
      {!lessonDetail && (error || loadAttempt > 0) ? (
        <button className="secondary-button" type="button" aria-disabled={lessonLoading} onClick={retryLesson}>
          Retry loading lesson
        </button>
      ) : null}
      {!lessonDetail ? (error || loadAttempt > 0 ? null : <PanelLoader label="Loading lesson..." />) : (
        <div className="content-grid">
          <section className="content-card">
            <div className="lesson-header">
              <div>
                <p className="eyebrow">
                  Lesson {lessonDetail.lesson.orderIndex} · {lessonDetail.lesson.stage}
                </p>
                <h2 ref={contentHeading} tabIndex={-1}>{lessonDetail.lesson.title}</h2>
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
              <ReactMarkdown components={markdownHeadings}>{lessonDetail.lesson.content}</ReactMarkdown>
            </div>
          </section>

          <section className="side-column">
            <article className="content-card">
              <div className="section-heading">
                <h3>Progress</h3>
                <span className="muted">
                  Last viewed {formatDate(lessonDetail.lesson.lastViewedAt)}
                </span>
              </div>

              <div className="status-controls" role="group" aria-label="Lesson status">
                {(['not_started', 'in_progress', 'completed'] as LessonStatus[]).map((status) => (
                  <button
                    key={status}
                    className={progressStatus === status ? 'is-selected' : ''}
                    onClick={() => { progressRevision.current++; setProgressStatus(status) }}
                    type="button"
                    aria-pressed={progressStatus === status}
                  >
                    {statusLabels[status]}
                  </button>
                ))}
              </div>

              <div className="confidence-scale">
                <div className="section-heading">
                  <h4>Confidence</h4>
                  <span className="muted">{confidenceLabels[confidence - 1]}</span>
                </div>
                <div className="confidence-buttons" role="group" aria-label="Confidence">
                  {confidenceLabels.map((label, index) => (
                    <button
                      key={label}
                      className={confidence === index + 1 ? 'is-selected' : ''}
                      onClick={() => { progressRevision.current++; setConfidence(index + 1) }}
                      type="button"
                      aria-label={`${index + 1}: ${label}`}
                      aria-pressed={confidence === index + 1}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="primary-button"
                aria-disabled={pendingAction !== null}
                onClick={handleSaveProgress}
                type="button"
              >
                {savingProgress ? 'Saving...' : 'Save progress'}
              </button>
            </article>

            <article className="content-card">
              <div className="section-heading">
                <h3 ref={quizHeading} tabIndex={-1}>{lessonDetail.quiz.title}</h3>
                <span className="muted">
                  Target score {lessonDetail.quiz.passingScore}%
                </span>
              </div>

              <div className="quiz-list" ref={quizQuestions}>
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
                aria-disabled={pendingAction !== null}
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
                <h3>Lesson notes</h3>
                <span className="muted">These are the teaching signals for future revisions.</span>
              </div>

              <label className="field">
                <span>How did this land?</span>
                <select
                  onChange={(event) =>
                    { noteRevision.current++; setUnderstandingState(event.target.value as UnderstandingState) }
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
                  aria-describedby="note-help"
                  onChange={(event) => { noteRevision.current++; setCommentBody(event.target.value) }}
                  placeholder="Example: I understand why the host owns permissions, but I still need a simpler example of session state versus workflow state."
                  rows={6}
                  value={commentBody}
                />
              </label>

              <p className="muted" id="note-help">Use at least 10 characters to save a note.</p>

              <button
                className="primary-button"
                aria-disabled={pendingAction !== null || commentBody.trim().length < 10}
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
                <h3>Related research</h3>
                <span className="muted">Open the underlying source notes at any time.</span>
              </div>

              <div className="related-list">
                {lessonDetail.relatedResearch.map((document) => (
                  <button
                    key={document.slug}
                    className="related-card"
                    onClick={() => onResearchSelect(document.slug)}
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
      )}
    </div>
  )
}
