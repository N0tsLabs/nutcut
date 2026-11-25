import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const SKILL = path.join(ROOT, 'skills', 'nutcut', 'SKILL.md')

test('nutcut skill has discoverable frontmatter', () => {
  const text = fs.readFileSync(SKILL, 'utf8')
  assert.match(text, /^---\n/)
  assert.match(text, /name: NutCut Video Workbench/)
  assert.match(text, /description: Use when/)
  assert.match(text, /install or attach/)
})

test('nutcut skill enforces spec and layout gates', () => {
  const text = fs.readFileSync(SKILL, 'utf8')
  assert.match(text, /不要默认 9:16 或 16:9/)
  assert.match(text, /layoutAdapted/)
  assert.match(text, /adapt-layout\.mjs/)
  assert.match(text, /issues\.json/)
})

test('only the nutcut skill is shipped', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  assert.deepEqual(dirs.sort(), ['nutcut'])
})

test('install-skill copies the skill to a target directory', () => {
  const dest = path.join(ROOT, '.cache', `skill-test-${process.pid}`)
  fs.rmSync(dest, { recursive: true, force: true })
  try {
    const result = spawnSync(process.execPath, ['bin/install-skill.mjs', '--dest', dest, '--force'], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')))
  } finally {
    fs.rmSync(dest, { recursive: true, force: true })
  }
})
