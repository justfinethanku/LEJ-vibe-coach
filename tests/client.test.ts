import assert from 'node:assert/strict'
import { register } from 'node:module'
import { tsImport } from 'tsx/esm/api'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import { createElement } from 'react'
import { JSDOM } from 'jsdom'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCoachStore } from '../server/store.js'
import type { LessonSeed } from '../server/content.js'

// Node exercises the actual React tree; CSS is validated by the production build.
register(`data:text/javascript,${encodeURIComponent(`
  export async function load(url, context, nextLoad) {
    if (new URL(url).pathname.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  }
`)}`, import.meta.url)
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const { render, fireEvent, waitFor, act, cleanup, configure } = await import('@testing-library/react')
// Shared ARM audit hosts can take longer than the default second to mount.
configure({ asyncUtilTimeout: 5000 })
const { default: App } = await tsImport('../src/App.tsx', {
  parentURL: import.meta.url, tsconfig: fileURLToPath(new URL('../tsconfig.app.json', import.meta.url)),
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const seed = (slug: string, orderIndex: number): LessonSeed => ({
  slug, title: `Lesson ${slug}`, orderIndex, stage: 'Foundations', difficulty: 'Intro',
  estimatedMinutes: 5, summary: `Study ${slug}`, goals: [`Explain ${slug}`],
  content: `Learning ${slug}`, relatedResearchSlugs: ['notes'], quizTitle: `Quiz ${slug}`,
  quizQuestions: [{ prompt: `Choose ${slug}`, options: ['Yes', 'No'], correctOption: 'Yes', explanation: 'Use Yes.' }],
})

type Fixture = Awaited<ReturnType<typeof fixture>>
async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-client-'))
  writeFileSync(join(directory, 'notes.md'), '# Research notes\nOriginal research.')
  const db = new Database(':memory:')
  const options = {
    project: { slug: 'fixture', title: 'Fixture', description: 'Test learning' },
    track: { slug: 'basics', title: 'Basics', description: 'Basics' },
    lessons: [seed('A', 1), seed('B', 2)], researchDirectory: directory, researchMetadata: {},
  }
  const store = createCoachStore(db, options)
  store.initializeDatabase()
  store.syncSeedData()
  const gate = deferred<Response>()
  const dashboardGates: Array<ReturnType<typeof deferred<void>>> = []
  let gateNextWrite = false
  let failDashboard = false
  let failWrite = false
  let failLesson: string | null = null
  const lessonGates: Array<ReturnType<typeof deferred<void>>> = []
  let lessonReads = 0
  let writeCount = 0
  let written = false
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
  t.mock.method(globalThis, 'fetch', async (input: string, init?: RequestInit) => {
    const path = input.split('/')
    if (init?.method === 'POST') {
      writeCount++
      if (failWrite) return json({ error: 'Write refused.' }, 400)
      const body = JSON.parse(init.body as string)
      const result = path[2] === 'quizzes'
        ? store.submitQuizAnswers(Number(path[3]), body.answers)
        : path[4] === 'comments'
          ? store.addLessonComment(path[3], body.body, body.understandingState)
          : store.updateLessonProgress(path[3], body.status, body.confidence)
      written = true
      if (gateNextWrite) {
        const response = await gate.promise
        return response.status === 204 ? json(result) : response
      }
      return json(result)
    }
    if (input === '/api/bootstrap') {
      if (failDashboard) return json({ error: 'Dashboard unavailable.' }, 503)
      const snapshot = json(store.getBootstrapData())
      const held = dashboardGates.shift()
      if (held) await held.promise
      return snapshot
    }
    if (path[2] === 'lessons') {
      lessonReads++
      const held = lessonGates.shift()
      if (held) await held.promise
      if (failLesson === path[3]) return json({ error: 'Lesson unavailable.' }, 503)
      return json(store.getLessonDetail(path[3]))
    }
    if (path[2] === 'research') return json(store.getResearchDocumentDetail(path[3]))
    throw new Error(`Unexpected fetch ${input}`)
  })
  const ui = render(createElement(App))
  t.after(() => { cleanup(); db.close(); rmSync(directory, { recursive: true, force: true }) })
  await ui.findByRole('heading', { name: 'Lesson A' })
  return {
    ui, store, options,
    delayWrite: () => { gateNextWrite = true },
    holdDashboard: () => { const held = deferred<void>(); dashboardGates.push(held); return held },
    failDashboard: () => { failDashboard = true },
    failWrite: () => { failWrite = true },
    failLesson: (slug: string | null) => { failLesson = slug },
    holdLesson: () => { const held = deferred<void>(); lessonGates.push(held); return held },
    lessonReads: () => lessonReads,
    release: async () => { await act(async () => { gate.resolve(new Response(null, { status: 204 })) }) },
    waitWritten: () => waitFor(() => assert.equal(written, true)),
    writes: () => writeCount,
  }
}
const note = (f: Fixture, value: string) => fireEvent.change(
  f.ui.getByRole('textbox', { name: 'Write what clicked or what did not.' }), { target: { value } },
)
const select = async (f: Fixture, slug: string) => {
  fireEvent.click(f.ui.getByRole('button', { name: new RegExp(`^\\d+\\. Lesson ${slug}`) }))
  await f.ui.findByRole('heading', { name: `Lesson ${slug}` })
}
const startWrite = async (f: Fixture, kind: 'progress' | 'note' | 'quiz') => {
  if (kind === 'note') note(f, 'A note belonging to the old visit.')
  if (kind === 'quiz') fireEvent.click(f.ui.getByRole('radio', { name: 'Yes' }))
  fireEvent.click(f.ui.getByRole('button', { name: kind === 'note' ? 'Save note' : kind === 'quiz' ? 'Submit quiz' : 'Save progress' }))
  await f.waitWritten()
}

for (const kind of ['progress', 'note', 'quiz'] as const) {
  test(`late ${kind} completion cannot replace another lesson or its draft`, async (t) => {
    const f = await fixture(t)
    f.delayWrite()
    await startWrite(f, kind)
    await select(f, 'B')
    note(f, 'B draft must survive the A response.')
    await f.release()
    assert.ok(f.ui.getByRole('heading', { name: 'Lesson B' }))
    assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, 'B draft must survive the A response.')
    assert.equal(Boolean(f.ui.queryByText(/Quiz scored/)), false)
    assert.equal(f.writes(), 1)
  })
}

test('returning to the same slug creates a new visit that ignores old quiz completion', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'quiz')
  await select(f, 'B')
  await select(f, 'A')
  note(f, 'A new visit with an independent draft.')
  await f.release()
  assert.equal(Boolean(f.ui.queryByText('1/1 correct')), false)
  assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, 'A new visit with an independent draft.')
})

test('typing a new note while a save is pending preserves the new draft', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'note')
  note(f, 'A newer unsaved note typed during the save.')
  await f.release()
  assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, 'A newer unsaved note typed during the save.')
  assert.equal(f.store.getLessonDetail('A')!.comments.length, 1)
})

test('acknowledged note stays saved when dashboard refresh fails; failed writes retain drafts', async (t) => {
  const f = await fixture(t)
  f.failDashboard()
  note(f, 'This note must commit only once.')
  fireEvent.click(f.ui.getByRole('button', { name: 'Save note' }))
  await waitFor(() => assert.match(f.ui.getByRole('status').textContent!, /Note saved/))
  assert.match(f.ui.getByRole('alert').textContent!, /saved.*dashboard/i)
  assert.ok(f.ui.getByText('This note must commit only once.'))
  assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, '')
  assert.equal(f.writes(), 1)
  f.failWrite()
  note(f, 'This unsaved note needs to survive.')
  fireEvent.click(f.ui.getByRole('button', { name: 'Save note' }))
  await waitFor(() => assert.match(f.ui.getByRole('alert').textContent!, /Write refused/))
  assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, 'This unsaved note needs to survive.')
  assert.equal(f.store.getLessonDetail('A')!.comments.length, 1)
})

test('a failed new lesson load never leaves the previous lesson writable', async (t) => {
  const f = await fixture(t)
  f.failLesson('B')
  fireEvent.click(f.ui.getByRole('button', { name: /^2\. Lesson B/ }))
  await f.ui.findByText('Lesson unavailable.')
  assert.equal(Boolean(f.ui.queryByRole('button', { name: 'Save progress' })), false)
  assert.equal(Boolean(f.ui.queryByRole('heading', { name: 'Lesson A' })), false)
})

test('research detour retains lesson drafts and restores requested heading focus', async (t) => {
  const f = await fixture(t)
  note(f, 'A draft retained through research navigation.')
  fireEvent.click(f.ui.getAllByRole('button', { name: /^Research notes/ })[0])
  await f.ui.findByRole('heading', { name: 'Research notes', level: 2 })
  await waitFor(() => assert.equal(document.activeElement?.textContent, 'Research notes'))
  fireEvent.click(f.ui.getByRole('button', { name: 'Back to lesson' }))
  await waitFor(() => assert.equal(document.activeElement?.textContent, 'Lesson A'))
  assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, 'A draft retained through research navigation.')
})

test('one lesson mutation owns the busy state and suppresses overlapping writes', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'note')
  for (const name of ['Save progress', 'Submit quiz']) {
    const button = f.ui.getByRole('button', { name })
    assert.equal(button.getAttribute('aria-disabled'), 'true')
    fireEvent.click(button)
  }
  fireEvent.click(f.ui.getByRole('button', { name: 'Saving...' }))
  assert.equal(f.writes(), 1)
  await f.release()
  assert.equal(f.store.getLessonDetail('A')!.comments.length, 1)
})

test('progress edited during an acknowledged save remains the next unsaved draft', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'progress')
  fireEvent.click(f.ui.getByRole('button', { name: 'Completed' }))
  fireEvent.click(f.ui.getByRole('button', { name: '5: Could teach it' }))
  await f.release()
  assert.equal(f.ui.getByRole('button', { name: 'Completed' }).getAttribute('aria-pressed'), 'true')
  assert.equal(f.ui.getByRole('button', { name: '5: Could teach it' }).getAttribute('aria-pressed'), 'true')
  assert.equal(f.store.getLessonDetail('A')!.lesson.status, 'not_started')
})

test('same-lesson curriculum replacement discards answers and feedback for the old grading version', async (t) => {
  const f = await fixture(t)
  await startWrite(f, 'quiz')
  await f.ui.findByText('1/1 correct')
  await waitFor(() => assert.equal(f.ui.getByRole('button', { name: 'Save progress' }).getAttribute('aria-disabled'), 'false'))
  note(f, 'A note draft independent of the quiz version.')
  f.options.lessons[0].quizQuestions[0].correctOption = 'No'
  f.store.syncSeedData()
  fireEvent.click(f.ui.getByRole('button', { name: 'Save progress' }))
  await waitFor(() => assert.equal(Boolean(f.ui.queryByText('1/1 correct')), false))
  assert.equal((f.ui.getByRole('radio', { name: 'Yes' }) as HTMLInputElement).checked, false)
  assert.equal((f.ui.getByRole('textbox') as HTMLTextAreaElement).value, 'A note draft independent of the quiz version.')
})

test('a scored quiz remains acknowledged when lesson refresh fails', async (t) => {
  const f = await fixture(t)
  f.failLesson('A')
  await startWrite(f, 'quiz')
  await waitFor(() => assert.match(f.ui.getByRole('alert').textContent!, /Quiz scored 100%.*Lesson refresh failed/))
  assert.ok(f.ui.getByText('1/1 correct'))
  assert.match(f.ui.getByRole('status').textContent!, /Quiz scored 100%/)
  assert.equal(f.store.getBootstrapData().dashboard.attemptCount, 1)
  assert.equal(f.writes(), 1)
})

test('an older dashboard response cannot overwrite a newer lesson save', async (t) => {
  const f = await fixture(t)
  const oldDashboard = f.holdDashboard()
  fireEvent.click(f.ui.getByRole('button', { name: 'Completed' }))
  await startWrite(f, 'progress')
  await f.ui.findByText('Progress saved.')
  await select(f, 'B')
  fireEvent.click(f.ui.getByRole('button', { name: 'Completed' }))
  fireEvent.click(f.ui.getByRole('button', { name: 'Save progress' }))
  await waitFor(() => assert.equal(f.ui.container.querySelector('.metric-card strong')?.textContent, '100%'))
  await act(async () => { oldDashboard.resolve() })
  assert.equal(f.ui.container.querySelector('.metric-card strong')?.textContent, '100%')
  assert.equal(f.writes(), 2)
})

test('normal learner flow preserves scoring, completion, notes and dashboard behavior', async (t) => {
  const f = await fixture(t)
  fireEvent.click(f.ui.getByRole('button', { name: 'Completed' }))
  fireEvent.click(f.ui.getByRole('button', { name: '4: Mostly solid' }))
  await startWrite(f, 'progress')
  await f.ui.findByText('Progress saved.')
  await waitFor(() => assert.equal(f.ui.getByRole('button', { name: 'Save progress' }).getAttribute('aria-disabled'), 'false'))
  await startWrite(f, 'note')
  await f.ui.findByText('Note saved.')
  await waitFor(() => assert.equal(f.ui.getByRole('button', { name: 'Submit quiz' }).getAttribute('aria-disabled'), 'false'))
  await startWrite(f, 'quiz')
  await f.ui.findByText('1/1 correct')
  await waitFor(() => assert.equal(f.ui.getByRole('button', { name: 'Submit quiz' }).getAttribute('aria-disabled'), 'false'))
  fireEvent.click(f.ui.getByRole('radio', { name: 'No' }))
  fireEvent.click(f.ui.getByRole('button', { name: 'Submit quiz' }))
  await f.ui.findByText('0/1 correct')
  const detail = f.store.getLessonDetail('A')!
  assert.equal(detail.lesson.status, 'completed')
  assert.equal(detail.lesson.confidence, 4)
  assert.equal(detail.lesson.quizBest, 100)
  assert.equal(detail.lesson.quizAverage, 50)
  assert.equal(detail.quiz.recentAttempts.length, 2)
  assert.equal(detail.comments.length, 1)
  await waitFor(() => assert.equal(f.ui.container.querySelector('.metric-card strong')?.textContent, '50%'))
  assert.equal(f.store.getBootstrapData().dashboard.averageQuizScore, 50)
})

test('failed lesson load can be retried once at a time without leaving the lesson', async (t) => {
  const f = await fixture(t)
  f.failLesson('B')
  fireEvent.click(f.ui.getByRole('button', { name: /^2\. Lesson B/ }))
  await f.ui.findByRole('alert')
  const retry = f.ui.getByRole('button', { name: 'Retry loading lesson' })
  retry.focus()
  const held = f.holdLesson()
  const before = f.lessonReads()
  fireEvent.click(retry)
  fireEvent.click(retry)
  await waitFor(() => assert.equal(f.lessonReads(), before + 1))
  assert.equal(retry.getAttribute('aria-disabled'), 'true')
  assert.ok(document.activeElement === retry)
  assert.match(f.ui.getByRole('status').textContent!, /Retrying lesson/)
  await act(async () => { held.resolve() })
  await f.ui.findByRole('alert')
  assert.ok(document.activeElement === retry)
  assert.equal(retry.getAttribute('aria-disabled'), 'false')
  assert.doesNotMatch(f.ui.getByRole('status').textContent!, /Retrying/)
  f.failLesson(null)
  fireEvent.click(retry)
  await f.ui.findByRole('heading', { name: 'Lesson B' })
  await waitFor(() => assert.equal(document.activeElement?.textContent, 'Lesson B'))
  assert.equal(Boolean(f.ui.queryByRole('alert')), false)
  assert.equal(Boolean(f.ui.queryByRole('button', { name: 'Retry loading lesson' })), false)
  assert.equal(f.writes(), 0)
})

test('replacement announces cleared quiz state and restores focus from a removed answer', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'progress')
  const oldRadio = f.ui.getByRole('radio', { name: 'Yes' })
  fireEvent.click(oldRadio)
  oldRadio.focus()
  f.options.lessons[0].quizQuestions[0].correctOption = 'No'
  f.store.syncSeedData()
  // The delayed POST already captured the old version; a second save reads
  // the replacement while focus remains on the earlier answer.
  await f.release()
  fireEvent.click(f.ui.getByRole('button', { name: 'Save progress' }))
  await waitFor(() => assert.equal(oldRadio.isConnected, false))
  assert.match(f.ui.getByRole('status').textContent!, /Quiz questions changed.*cleared.*Review/i)
  assert.equal(document.activeElement?.textContent, 'Quiz A')
  assert.equal((f.ui.getByRole('radio', { name: 'Yes' }) as HTMLInputElement).checked, false)
  assert.equal(f.store.getLessonDetail('A')!.quiz.recentAttempts.length, 0)
})

test('replacement notice preserves an unrelated note draft and its focus, including after save failure', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'progress')
  f.options.lessons[0].quizQuestions[0].correctOption = 'No'
  f.store.syncSeedData()
  await f.release()
  fireEvent.click(f.ui.getByRole('button', { name: 'Save progress' }))
  const draft = f.ui.getByRole('textbox') as HTMLTextAreaElement
  note(f, 'Keep this draft and the keyboard here.')
  draft.focus()
  await waitFor(() => assert.match(f.ui.getByRole('status').textContent!, /Quiz questions changed/))
  assert.ok(document.activeElement === draft)
  assert.equal(draft.value, 'Keep this draft and the keyboard here.')
  f.failWrite()
  fireEvent.click(f.ui.getByRole('button', { name: 'Save note' }))
  await f.ui.findByText('Write refused.')
  assert.match(f.ui.getByRole('status').textContent!, /Quiz questions changed/)
  assert.ok(document.activeElement === draft)
})

test('unchanged grading refresh keeps focused answer and has no replacement notice', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'progress')
  const radio = f.ui.getByRole('radio', { name: 'Yes' }) as HTMLInputElement
  fireEvent.click(radio)
  radio.focus()
  await f.release()
  assert.ok(document.activeElement === radio)
  assert.equal(radio.checked, true)
  assert.doesNotMatch(f.ui.getByRole('status').textContent!, /Quiz questions changed/)
})

test('replacement after a committed quiz labels its score as the previous version', async (t) => {
  const f = await fixture(t)
  f.delayWrite()
  await startWrite(f, 'quiz')
  f.options.lessons[0].quizQuestions[0].correctOption = 'No'
  f.store.syncSeedData()
  await f.release()
  assert.match(f.ui.getByRole('status').textContent!, /Previous quiz scored 100%.*Quiz questions changed/)
  assert.equal(Boolean(f.ui.queryByText('1/1 correct')), false)
  assert.equal(f.store.getLessonDetail('A')!.quiz.recentAttempts.length, 1)
})

test('hidden replacement cannot pull focus away from the research document', async (t) => {
  const f = await fixture(t)
  f.options.lessons[0].quizQuestions[0].correctOption = 'No'
  f.store.syncSeedData()
  f.delayWrite()
  await startWrite(f, 'progress')
  f.ui.getByRole('radio', { name: 'Yes' }).focus()
  fireEvent.click(f.ui.getAllByRole('button', { name: /^Research notes/ })[0])
  await waitFor(() => assert.equal(document.activeElement?.textContent, 'Research notes'))
  await f.release()
  assert.equal(document.activeElement?.textContent, 'Research notes')
  fireEvent.click(f.ui.getByRole('button', { name: 'Back to lesson' }))
  await waitFor(() => assert.equal(document.activeElement?.textContent, 'Lesson A'))
  assert.match(f.ui.getByRole('status').textContent!, /Quiz questions changed/)
})

test('leaving a pending retry ignores its late success and focus request', async (t) => {
  const f = await fixture(t)
  f.failLesson('B')
  fireEvent.click(f.ui.getByRole('button', { name: /^2\. Lesson B/ }))
  await f.ui.findByRole('alert')
  f.failLesson(null)
  const held = f.holdLesson()
  const retry = f.ui.getByRole('button', { name: 'Retry loading lesson' })
  fireEvent.click(retry)
  await select(f, 'A')
  note(f, 'Keep the new lesson draft after retry.')
  const draft = f.ui.getByRole('textbox') as HTMLTextAreaElement
  draft.focus()
  await act(async () => { held.resolve() })
  assert.ok(document.activeElement === draft)
  assert.equal(draft.value, 'Keep the new lesson draft after retry.')
  assert.equal(Boolean(f.ui.queryByRole('heading', { name: 'Lesson B' })), false)
})
