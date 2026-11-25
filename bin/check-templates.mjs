#!/usr/bin/env node
/**
 * 批量检查模板：逐套渲染 1 张关键帧，确认 render.mjs 能加载、renderFrame 不报错。
 *
 *   node bin/check-templates.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve('templates')
const outDir = path.resolve('out/_template-check')
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
const items = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .filter((id) => fs.existsSync(path.join(root, id, 'motion.json')))
  .sort()
const failures = []
for (const id of items) {
  const out = path.join(outDir, `${id}.png`)
  const result = spawnSync('node', ['bin/render.mjs', '--template', path.join('templates', id), '--out', out, '--frames', '30'], { encoding: 'utf8' })
  if (result.status !== 0) {
    failures.push({ id, error: (result.stderr || result.stdout || '').slice(-600) })
    console.error(`FAIL ${id}`)
  } else {
    console.log(`OK   ${id}`)
  }
}
fs.rmSync(outDir, { recursive: true, force: true })
console.log(JSON.stringify({ ok: failures.length === 0, total: items.length, failures }, null, 2))
process.exit(failures.length ? 1 : 0)
