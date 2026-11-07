import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import {
  fetchBootstrap,
  fetchResearchDocument,
} from './lib/api'
import type {
  BootstrapData,
  LessonStatus,
  ResearchDocumentDetail,
} from './lib/types'
import './App.css'
import LessonWorkspace from './LessonWorkspace'
import PanelLoader from './PanelLoader'

const statusLabels: Record<LessonStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

// Imported Markdown sits below the lesson/research heading in the page outline.
const markdownHeadings = {
  h1: 'h3', h2: 'h3', h3: 'h4', h4: 'h5', h5: 'h6', h6: 'h6',
} as const

function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null)
  const [activeView, setActiveView] = useState<'lesson' | 'research'>('lesson')
  const [selectedLessonSlug, setSelectedLessonSlug] = useState<string | null>(null)
  const [selectedResearchSlug, setSelectedResearchSlug] = useState<string | null>(null)
  const [researchDetail, setResearchDetail] = useState<ResearchDocumentDetail | null>(
    null,
  )
  const [researchLoading, setResearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lessonFocusRequest, setLessonFocusRequest] = useState(0)
  const dashboardRequest = useRef({ revision: 0, active: false })
  const contentHeading = useRef<HTMLHeadingElement>(null)
  const focusContentAfterNavigation = useRef(false)
  const researchRequestPending = useRef(false)

  const refreshDashboard = useCallback(async () => {
    const lifecycle = dashboardRequest.current
    if (!lifecycle.active) return
    const request = ++lifecycle.revision
    try {
      const data = await fetchBootstrap()
      if (!lifecycle.active || request !== lifecycle.revision) return
      setBootstrap(data)
      setSelectedLessonSlug((current) => current ?? data.dashboard.nextRecommendedLesson)
      setSelectedResearchSlug((current) => current ?? data.researchDocuments[0]?.slug ?? null)
    } catch (loadError) {
      if (lifecycle.active && request === lifecycle.revision) throw loadError
    }
  }, [])

  useEffect(() => {
    const lifecycle = dashboardRequest.current
    lifecycle.active = true
    void refreshDashboard().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load app data.')
    })
    return () => { lifecycle.active = false; lifecycle.revision++ }
  }, [refreshDashboard])

  useEffect(() => {
    if (!selectedResearchSlug || activeView !== 'research') {
      return
    }

    researchRequestPending.current = true
    setResearchLoading(true)
    setError(null)

    let cancelled = false
    void (async () => {
      try {
        const detail = await fetchResearchDocument(selectedResearchSlug)
        if (!cancelled) setResearchDetail(detail)
      } catch (loadError) {
        if (!cancelled) setError(
          loadError instanceof Error ? loadError.message : 'Failed to load research document.',
        )
      } finally {
        if (!cancelled) {
          researchRequestPending.current = false
          setResearchLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [selectedResearchSlug, activeView])

  useEffect(() => {
    const ready = activeView === 'research' && !researchRequestPending.current && !researchLoading && researchDetail?.slug === selectedResearchSlug
    if (focusContentAfterNavigation.current && ready && contentHeading.current) {
      contentHeading.current.focus()
      focusContentAfterNavigation.current = false
    }
  }, [activeView, researchDetail, researchLoading, selectedResearchSlug])

  const selectedLessonSummary =
    bootstrap?.lessons.find((lesson) => lesson.slug === selectedLessonSlug) ?? null

  const handleLessonSelect = (slug: string) => {
    focusContentAfterNavigation.current = false
    setError(null)
    startTransition(() => {
      setActiveView('lesson')
      setSelectedLessonSlug(slug)
      setLessonFocusRequest((current) => current + 1)
    })
  }

  const handleResearchSelect = (slug: string) => {
    focusContentAfterNavigation.current = true
    if (activeView === 'research' && selectedResearchSlug === slug && !researchLoading) {
      contentHeading.current?.focus()
      focusContentAfterNavigation.current = false
    }
    startTransition(() => {
      setActiveView('research')
      setSelectedResearchSlug(slug)
    })
  }

  const progressPercent = bootstrap
    ? Math.round((bootstrap.dashboard.completedLessons / bootstrap.dashboard.totalLessons) * 100)
    : 0

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to learning content</a>
      <aside className="sidebar">
        <div className="sidebar__header">
          <p className="eyebrow">The educational platform that teaches you while you build</p>
          <h1>Vibe Coach</h1>
          <p className="sidebar__copy">
            Research lives in SQLite. Lessons, notes, quizzes, and learner feedback build on top of it.
          </p>
        </div>

        <nav className="sidebar__section" aria-label="Lesson path">
          <div className="sidebar__section-title">
            <h2>Lesson path</h2>
            <span>{bootstrap?.dashboard.completedLessons ?? 0}/{bootstrap?.dashboard.totalLessons ?? 0}</span>
          </div>
          <div className="sidebar__list">
            {bootstrap?.lessons.map((lesson) => (
              <button
                key={lesson.slug}
                className={`nav-card ${selectedLessonSlug === lesson.slug && activeView === 'lesson' ? 'is-active' : ''}`}
                onClick={() => handleLessonSelect(lesson.slug)}
                type="button"
                aria-current={selectedLessonSlug === lesson.slug && activeView === 'lesson' ? 'page' : undefined}
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
        </nav>

        <nav className="sidebar__section" aria-label="Research library">
          <div className="sidebar__section-title">
                    <h2>Research library</h2>
                    <span>{bootstrap?.researchDocuments.length ?? 0} docs</span>
          </div>
          <div className="sidebar__list sidebar__list--compact">
            {bootstrap?.researchDocuments.map((document) => (
              <button
                key={document.slug}
                className={`nav-card nav-card--compact ${selectedResearchSlug === document.slug && activeView === 'research' ? 'is-active' : ''}`}
                onClick={() => handleResearchSelect(document.slug)}
                type="button"
                aria-current={selectedResearchSlug === document.slug && activeView === 'research' ? 'page' : undefined}
              >
                <strong>{document.title}</strong>
                <p>{document.summary}</p>
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <main className="main-panel" id="main-content" tabIndex={-1}>
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

        {error ? <div className="error-banner" role="alert">{error}</div> : null}

        <div className="view-toggle" role="group" aria-label="Workspace view">
          <button
            className={activeView === 'lesson' ? 'is-selected' : ''}
            onClick={() => selectedLessonSlug && handleLessonSelect(selectedLessonSlug)}
            type="button"
            aria-pressed={activeView === 'lesson'}
          >
            Learning studio
          </button>
          <button
            className={activeView === 'research' ? 'is-selected' : ''}
            onClick={() => selectedResearchSlug && handleResearchSelect(selectedResearchSlug)}
            type="button"
            aria-pressed={activeView === 'research'}
          >
            Research vault
          </button>
        </div>

        {selectedLessonSlug ? (
          <LessonWorkspace
            key={selectedLessonSlug}
            slug={selectedLessonSlug}
            active={activeView === 'lesson'}
            focusRequest={lessonFocusRequest}
            onResearchSelect={handleResearchSelect}
            onDashboardRefresh={refreshDashboard}
          />
        ) : null}
        {activeView === 'research' ? (researchLoading || !researchDetail ? (
          <PanelLoader label="Loading research..." />
        ) : (
          <section className="content-card content-card--wide">
            <div className="lesson-header">
              <div>
                <p className="eyebrow">Research library · {researchDetail.category}</p>
                <h2 ref={contentHeading} tabIndex={-1}>{researchDetail.title}</h2>
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
              <ReactMarkdown components={markdownHeadings}>{researchDetail.content}</ReactMarkdown>
            </div>
          </section>
        )) : null}
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

export default App
