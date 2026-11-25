import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createProject } from '../src/project-create.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const ID = `test-status-${process.pid}`

test('status waits for confirmation instead of pushing render', () => {
  fs.rmSync(path.join(ROOT, 'projects', ID), { recursive: true, force: true })
  try {
    createProject({
      root: ROOT,
      id: ID,
      title: '状态测试',
      template: 'tech-neon',
      spec: { orientation: 'landscape', quality: '1080p', fps: 30, duration: 10, audio: 'none' },
    })
    const file = path.join(ROOT, 'projects', ID, 'project.json')
    const project = JSON.parse(fs.readFileSync(file, 'utf8'))
    project.status = 'review'
    project.pipeline = (project.pipeline || []).map((step) => step.id === 'review' ? { ...step, status: 'doing' } : step)
    fs.writeFileSync(file, JSON.stringify(project, null, 2) + '\n')

    const result = spawnSync(process.execPath, ['bin/status.mjs', '--project', `projects/${ID}`, '--json'], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const data = JSON.parse(result.stdout)
    const next = data.next.join('\n')
    assert.match(next, /确认|审阅/)
    assert.doesNotMatch(next, /produce\.mjs/)
    assert.doesNotMatch(next, /voice\.mjs/)
  } finally {
    fs.rmSync(path.join(ROOT, 'projects', ID), { recursive: true, force: true })
  }
})
