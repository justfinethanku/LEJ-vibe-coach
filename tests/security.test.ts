import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { once } from 'node:events'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { networkInterfaces, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '..')

// fetch can replace a caller-supplied Host; use HTTP directly for rebinding probes.
async function requestWithHost(url: string, host: string, body?: string) {
  return new Promise<number>((done, reject) => {
    const outgoing = request(url, {
      method: body ? 'POST' : 'GET',
      headers: { Host: host, 'Content-Type': 'application/json' },
    }, (response) => {
      response.resume()
      response.on('end', () => done(response.statusCode!))
    })
    outgoing.on('error', reject)
    outgoing.end(body)
  })
}

// Each server gets its own curriculum and SQLite files, never the user's data/.
async function startFixture(production = false) {
  const dir = mkdtempSync(join(tmpdir(), 'vibe-coach-security-'))
  for (const name of ['server', 'research', 'vibe-coach.project.ts', 'package.json']) {
    cpSync(join(root, name), join(dir, name), { recursive: true })
  }
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
  if (production) {
    mkdirSync(join(dir, 'dist'))
    writeFileSync(join(dir, 'dist/index.html'), '<h1>Security fixture</h1>')
  }
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const address = reservation.address()
  assert.ok(address && typeof address === 'object')
  const port = address.port
  await new Promise<void>((done) => reservation.close(() => done()))
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), NODE_ENV: production ? 'production' : 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (data) => { output += data })
  child.stderr.on('data', (data) => { output += data })
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    rmSync(dir, { recursive: true, force: true })
  }
  try {
    const deadline = Date.now() + 10_000
    while (!output.includes('server listening')) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error(output || 'Startup timed out')
      await new Promise((done) => setTimeout(done, 20))
    }
  } catch (error) {
    await stop()
    throw error
  }
  return { url: `http://127.0.0.1:${port}`, port, stop, directory: dir }
}

test('local API rejects untrusted browser requests without changing learner state', async (t) => {
  const server = await startFixture()
  t.after(server.stop)
  const bootstrap = await (await fetch(`${server.url}/api/bootstrap`)).json()
  const slug = bootstrap.lessons[0].slug
  const endpoint = `${server.url}/api/lessons/${slug}/progress`
  const change = JSON.stringify({ status: 'completed', confidence: 5 })
  for (const headers of [
    { Origin: 'https://attacker.invalid' },
    { Origin: 'null' },
    { Origin: 'http://localhost.attacker.invalid:5173' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ]) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: change,
    })
    assert.equal(response.status, 403, JSON.stringify(headers))
  }
  for (const host of ['rebind.attacker.invalid', 'localhost.attacker.invalid']) {
    assert.equal(await requestWithHost(endpoint, host, change), 403, host)
    assert.equal(await requestWithHost(`${server.url}/api/bootstrap`, host), 403, host)
  }
  const detail = await (await fetch(`${server.url}/api/lessons/${slug}`)).json()
  assert.equal(detail.lesson.status, 'not_started')
  assert.equal(detail.lesson.confidence, 1)

  // Both development-proxy and production origins retain the normal flow.
  for (const Origin of ['http://localhost:5173', `http://127.0.0.1:${server.port}`]) {
    const saved = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin }, body: change,
    })
    assert.equal(saved.status, 200)
    assert.equal((await saved.json()).lesson.status, 'completed')
  }
  const note = '<script>alert("fixture")</script> learner note'
  const comment = await fetch(`${server.url}/api/lessons/${slug}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: note, understandingState: 'clear' }),
  })
  assert.equal(comment.status, 200)
  assert.equal((await comment.json()).comments[0].body, note)
  const quiz = await fetch(`${server.url}/api/quizzes/${detail.quiz.id}/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: detail.quiz.questions.map((question: { id: number; options: string[] }) => ({
      questionId: question.id, selectedOption: question.options[0],
    })) }),
  })
  assert.equal(quiz.status, 200)
  assert.equal((await quiz.json()).totalQuestions, detail.quiz.questions.length)
  const research = await fetch(`${server.url}/api/research/${bootstrap.researchDocuments[0].slug}`)
  assert.equal(research.status, 200)
  assert.ok((await research.json()).content.length > 0)
  assert.equal((await fetch(`${server.url}/api/lessons/${encodeURIComponent("' OR 1=1 --")}`)).status, 404)
})

test('quiz API rejects incomplete and unrelated answers without changing learner state', async (t) => {
  const server = await startFixture()
  t.after(server.stop)
  const bootstrap = await (await fetch(`${server.url}/api/bootstrap`)).json()
  const detailUrl = `${server.url}/api/lessons/${bootstrap.lessons[0].slug}`
  const detail = await (await fetch(detailUrl)).json()
  const answers = detail.quiz.questions.map((question: { id: number; options: string[] }) => ({
    questionId: question.id, selectedOption: question.options[0],
  }))
  const other = await (await fetch(`${server.url}/api/lessons/${bootstrap.lessons[1].slug}`)).json()
  const endpoint = `${server.url}/api/quizzes/${detail.quiz.id}/submit`
  const post = (url: string, body: unknown) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const cases = [
    { name: 'empty', answers: [] },
    { name: 'missing', answers: answers.slice(1) },
    { name: 'duplicate', answers: [answers[0], ...answers.slice(0, -1)] },
    { name: 'foreign', answers: [{ ...answers[0], questionId: other.quiz.questions[0].id }, ...answers.slice(1)] },
    { name: 'unknown', answers: [{ ...answers[0], questionId: 999_999 }, ...answers.slice(1)] },
    { name: 'invalid option', answers: [{ ...answers[0], selectedOption: 'Not offered' }, ...answers.slice(1)] },
    { name: 'blank', answers: [{ ...answers[0], selectedOption: '' }, ...answers.slice(1)] },
    { name: 'noninteger question', answers: [{ ...answers[0], questionId: 1.5 }, ...answers.slice(1)] },
  ]
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const response = await post(endpoint, { answers: entry.answers })
      assert.equal(response.status, 400)
      assert.equal(typeof (await response.json()).error, 'string')
      assert.deepEqual(await (await fetch(detailUrl)).json(), detail)
      assert.deepEqual(await (await fetch(`${server.url}/api/bootstrap`)).json(), bootstrap)
    })
  }
  assert.equal((await post(`${server.url}/api/quizzes/999999/submit`, { answers })).status, 400)
  assert.equal((await post(endpoint, {})).status, 400)
  // Correctly shaped wrong choices still count as real attempts.
  const accepted = await post(endpoint, { answers: answers.reverse() })
  assert.equal(accepted.status, 200)
  const result = await accepted.json()
  assert.equal(result.totalQuestions, detail.quiz.questions.length)
  const after = await (await fetch(detailUrl)).json()
  assert.equal(after.lesson.status, 'in_progress')
  assert.equal(after.quiz.recentAttempts.length, 1)
  assert.equal(after.quiz.recentAttempts[0].score, result.score)
  assert.equal((await (await fetch(`${server.url}/api/bootstrap`)).json()).dashboard.attemptCount, 1)
})

test('API socket is unavailable on a non-loopback interface', async (t) => {
  const lan = Object.values(networkInterfaces()).flat().find((address) => address?.family === 'IPv4' && !address.internal)
  if (!lan) return t.skip('No non-loopback IPv4 interface available')
  const server = await startFixture()
  t.after(server.stop)
  await assert.rejects(fetch(`http://${lan.address}:${server.port}/api/bootstrap`, {
    headers: { Host: 'localhost' }, signal: AbortSignal.timeout(1500),
  }))
})

test('production serves the root and client routes behind the same boundary', async (t) => {
  const server = await startFixture(true)
  t.after(server.stop)
  for (const path of ['/', '/lessons/orientation']) {
    const response = await fetch(`${server.url}${path}`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Security fixture/)
  }
  assert.equal(await requestWithHost(server.url, 'attacker.invalid'), 403)
})

test('a live server rejects a stale quiz after a separate curriculum refresh and accepts the reloaded lesson', async (t) => {
  const server = await startFixture()
  t.after(server.stop)
  const bootstrap = await (await fetch(`${server.url}/api/bootstrap`)).json()
  const detailUrl = `${server.url}/api/lessons/${bootstrap.lessons[0].slug}`
  const old = await (await fetch(detailUrl)).json()
  const endpoint = `${server.url}/api/quizzes/${old.quiz.id}/submit`
  const post = (detail: typeof old) => fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: detail.quiz.questions.map((question: { id: number; options: string[] }) => ({
      questionId: question.id, selectedOption: question.options[0],
    })) }),
  })
  assert.equal((await post(old)).status, 200)
  const refresh = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { LESSON_SEEDS } from './server/content.ts';
    import { syncSeedData } from './server/db.ts';
    const question = LESSON_SEEDS[0].quizQuestions[0];
    question.correctOption = question.options.find(option => option !== question.correctOption);
    syncSeedData();
  `], { cwd: server.directory, encoding: 'utf8', timeout: 10_000 })
  assert.equal(refresh.status, 0, refresh.stderr)
  const connection = new Database(join(server.directory, 'data/vibe-coach.sqlite'))
  t.after(() => connection.close())
  const snapshot = () => ['lesson_progress', 'lesson_comments', 'quiz_attempts', 'quiz_responses']
    .map((table) => connection.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
  const before = snapshot()
  const rejected = await post(old)
  assert.equal(rejected.status, 400)
  assert.match((await rejected.json()).error, /reload the lesson/)
  assert.deepEqual(snapshot(), before)
  const current = await (await fetch(detailUrl)).json()
  assert.notEqual(current.quiz.questions[0].id, old.quiz.questions[0].id)
  assert.equal((await post(current)).status, 200)
  assert.equal((await (await fetch(detailUrl)).json()).quiz.recentAttempts.length, 2)
  assert.deepEqual(connection.pragma('foreign_key_check'), [])
})
