import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createProject, ProjectCreateError } from '../src/project-create.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const ID = `test-create-${process.pid}`

function cleanup(id) {
  fs.rmSync(path.join(ROOT, 'projects', id), { recursive: true, force: true })
}

test('createProject writes spec, motion and layout flag', () => {
  cleanup(ID)
  try {
    const result = createProject({
      root: ROOT,
      id: ID,
      title: '测试项目',
      template: 'tech-neon',
      spec: { orientation: 'portrait', quality: '720p', fps: 30, duration: 12, audio: 'none' },
    })
    assert.equal(result.spec.width, 720)
    assert.equal(result.spec.height, 1280)
    assert.equal(result.needsLayoutAdaptation, true)

    const dir = path.join(ROOT, 'projects', ID)
    for (const file of ['project.json', 'brief.json', 'script.json', 'motion.json', 'issues.json']) {
      assert.ok(fs.existsSync(path.join(dir, file)), `${file} missing`)
    }
    const project = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'))
    assert.equal(project.spec.confirmed, true)
    assert.equal(project.layoutAdapted, false)
    assert.equal(project.pipeline[0].id, 'spec')

    const motion = JSON.parse(fs.readFileSync(path.join(dir, 'motion.json'), 'utf8'))
    assert.equal(motion.output.width, 720)
    assert.equal(motion.output.height, 1280)
    assert.equal(motion.output.fps, 30)
  } finally {
    cleanup(ID)
  }
})

test('createProject rejects missing spec', () => {
  cleanup(ID)
  try {
    assert.throws(
      () => createProject({ root: ROOT, id: ID, title: '测试', template: 'tech-neon', spec: {} }),
      (error) => error instanceof ProjectCreateError && error.questions.length >= 5,
    )
  } finally {
    cleanup(ID)
  }
})

test('createProject rejects duplicate id', () => {
  cleanup(ID)
  try {
    createProject({
      root: ROOT,
      id: ID,
      title: '测试',
      template: 'tech-neon',
      spec: { orientation: 'landscape', quality: '1080p', fps: 30, duration: 10 },
    })
    assert.throws(
      () => createProject({
        root: ROOT,
        id: ID,
        title: '测试',
        template: 'tech-neon',
        spec: { orientation: 'landscape', quality: '1080p', fps: 30, duration: 10 },
      }),
      (error) => error instanceof ProjectCreateError && error.status === 409,
    )
  } finally {
    cleanup(ID)
  }
})

test('adapt-layout marks layout ready and produce blocks before that', () => {
  const id = `test-adapt-${process.pid}`
  cleanup(id)
  try {
    createProject({
      root: ROOT,
      id,
      title: '测试适配',
      template: 'tech-neon',
      spec: { orientation: 'portrait', quality: '720p', fps: 30, duration: 10, audio: 'none' },
    })

    const blocked = spawnSync(process.execPath, ['bin/produce.mjs', '--project', `projects/${id}`], { cwd: ROOT, encoding: 'utf8' })
    assert.notEqual(blocked.status, 0)
    assert.match(String(blocked.stderr), /版式|适配/)

    const adapted = spawnSync(process.execPath, ['bin/adapt-layout.mjs', '--project', `projects/${id}`, '--confirm'], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(adapted.status, 0, adapted.stderr)
    const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects', id, 'project.json'), 'utf8'))
    assert.equal(project.layoutAdapted, true)
  } finally {
    cleanup(id)
  }
})

test('set-spec updates dimensions and resets layout adaptation', () => {
  const id = `test-setspec-${process.pid}`
  cleanup(id)
  try {
    createProject({
      root: ROOT,
      id,
      title: '?????',
      template: 'tech-neon',
      spec: { orientation: 'portrait', quality: '720p', fps: 30, duration: 10, audio: 'none' },
    })
    const adapted = spawnSync(process.execPath, ['bin/adapt-layout.mjs', '--project', `projects/${id}`, '--confirm'], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(adapted.status, 0, adapted.stderr)

    const changed = spawnSync(process.execPath, ['bin/set-spec.mjs', '--project', `projects/${id}`, '--orientation', 'landscape', '--quality', '1080p', '--fps', '30', '--duration', '10'], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(changed.status, 0, changed.stderr)
    const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects', id, 'project.json'), 'utf8'))
    assert.equal(project.spec.orientation, 'landscape')
    assert.equal(project.spec.width, 1920)
    assert.equal(project.layoutAdapted, false)
  } finally {
    cleanup(id)
  }
})
