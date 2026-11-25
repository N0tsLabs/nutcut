import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

test('doctor reports required checks and optional warnings', () => {
  const result = spawnSync(process.execPath, ['bin/doctor.mjs', '--json'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(result.stdout)
  assert.equal(data.ok, true)
  assert.ok(Array.isArray(data.checks) && data.checks.length >= 8)
  assert.ok(Array.isArray(data.warnings))
  const names = data.checks.map((check) => check.name)
  for (const required of ['Node', 'FFmpeg', 'FFprobe', '浏览器', '依赖', '模板']) {
    assert.ok(names.includes(required), `${required} check missing`)
  }
})
