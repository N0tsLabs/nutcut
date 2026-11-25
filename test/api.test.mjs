import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const PORT = 4600 + (process.pid % 200)
const ID = `test-api-${process.pid}`

async function waitFor(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* server not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`server did not start: ${url}`)
}

test('API enforces spec and layout gates', async () => {
  fs.rmSync(path.join(ROOT, 'projects', ID), { recursive: true, force: true })
  const child = spawn(process.execPath, ['console/server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, NUTCUT_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const base = `http://127.0.0.1:${PORT}`
  try {
    await waitFor(`${base}/api/health`)

    const noSpec = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ID, title: '测试 API', template: 'tech-neon' }),
    })
    assert.equal(noSpec.status, 400)
    const noSpecBody = await noSpec.json()
    assert.ok(Array.isArray(noSpecBody.questions) && noSpecBody.questions.length >= 5)

    const created = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ID,
        title: '测试 API',
        template: 'tech-neon',
        spec: { orientation: 'portrait', quality: '720p', fps: 30, duration: 10, audio: 'none' },
      }),
    })
    assert.equal(created.status, 200)
    const body = await created.json()
    assert.equal(body.ok, true)
    assert.equal(body.project.spec.width, 720)
    assert.equal(body.needsLayoutAdaptation, true)

    const exported = await fetch(`${base}/api/projects/${ID}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(exported.status, 409)
    const exportBody = await exported.json()
    assert.match(exportBody.error, /版式/)
  } finally {
    child.kill()
    fs.rmSync(path.join(ROOT, 'projects', ID), { recursive: true, force: true })
  }
})
