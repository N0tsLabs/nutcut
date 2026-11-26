import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createProject } from '../src/project-create.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const ID = `test-flow-${process.pid}`

function run(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' })
}

test('research route requires sources and ask blocks the project', () => {
  fs.rmSync(path.join(ROOT, 'projects', ID), { recursive: true, force: true })
  try {
    createProject({
      root: ROOT,
      id: ID,
      title: '流程测试',
      template: 'tech-neon',
      spec: { orientation: 'landscape', quality: '1080p', fps: 30, duration: 10, audio: 'none' },
    })
    const projectDir = path.join(ROOT, 'projects', ID)

    const route = run(['bin/route.mjs', '--project', `projects/${ID}`, '--mode', 'research'])
    assert.equal(route.status, 0, route.stderr)

    const missing = run(['bin/research.mjs', '--project', `projects/${ID}`, '--check'])
    assert.notEqual(missing.status, 0)

    fs.writeFileSync(path.join(projectDir, 'research.json'), JSON.stringify({
      question: 'test',
      queries: ['test'],
      sources: [
        { title: 'A', url: 'https://example.com/a', keyPoints: ['a'] },
        { title: 'B', url: 'https://example.com/b', keyPoints: ['b'] },
        { title: 'C', url: 'https://example.com/c', keyPoints: ['c'] },
      ],
      findings: ['finding'],
      angles: ['angle'],
    }, null, 2) + '\n')

    const check = run(['bin/research.mjs', '--project', `projects/${ID}`, '--check'])
    assert.equal(check.status, 0, check.stderr)

    const confirm = run(['bin/confirm.mjs', '--project', `projects/${ID}`, '--step', 'research'])
    assert.equal(confirm.status, 0, confirm.stderr)

    const ask = run(['bin/ask.mjs', '--project', `projects/${ID}`, '--question', 'Which platform?', '--options', 'A|B'])
    assert.equal(ask.status, 0, ask.stderr)
    const project = JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8'))
    assert.equal(project.pendingQuestion.status, 'open')

    const blocked = run(['bin/produce.mjs', '--project', `projects/${ID}`])
    assert.notEqual(blocked.status, 0)

    const clear = run(['bin/ask.mjs', '--project', `projects/${ID}`, '--clear'])
    assert.equal(clear.status, 0, clear.stderr)
  } finally {
    fs.rmSync(path.join(ROOT, 'projects', ID), { recursive: true, force: true })
  }
})
