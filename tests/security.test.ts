import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
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
  return { url: `http://127.0.0.1:${port}`, port, stop }
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
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: [] }),
  })
  assert.equal(quiz.status, 200)
  assert.equal((await quiz.json()).score, 0)
  const research = await fetch(`${server.url}/api/research/${bootstrap.researchDocuments[0].slug}`)
  assert.equal(research.status, 200)
  assert.ok((await research.json()).content.length > 0)
  assert.equal((await fetch(`${server.url}/api/lessons/${encodeURIComponent("' OR 1=1 --")}`)).status, 404)
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
