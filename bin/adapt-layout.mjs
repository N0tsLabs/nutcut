#!/usr/bin/env node
/**
 * 标记项目版式已经按目标规格适配。
 *
 *   node bin/adapt-layout.mjs --project projects/<id> --confirm
 *
 * 只做一件事：把 project.json.layoutAdapted 设为 true，并记录时间。
 * 不会自动改 HTML；改版式仍然由 Agent 完成。
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) {
  return process.argv.includes(`--${name}`)
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/adapt-layout.mjs --project projects/<id> --confirm')
  if (!has('confirm')) throw new Error('需要加 --confirm：确认已经改完 src/index.html 的版式，并且检查过关键帧')
  const projectDir = path.resolve(projectArg)
  const file = path.join(projectDir, 'project.json')
  const project = readJson(file)
  if (!project) throw new Error(`缺少 project.json：${file}`)
  if (!project.spec?.confirmed) throw new Error('还没有确认视频规格：先补 project.json 的 spec，再适配版式')
  if (project.layoutAdapted === true) {
    console.log(JSON.stringify({ ok: true, project: projectArg, layoutAdapted: true, note: '已经是适配状态，没有重复修改' }, null, 2))
    return
  }
  const next = {
    ...project,
    layoutAdapted: true,
    layoutAdaptedAt: new Date().toISOString(),
    layoutNote: String(arg('note', '')).trim() || `adapted to ${project.spec.width}x${project.spec.height}`,
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({
    ok: true,
    project: projectArg,
    layoutAdapted: true,
    spec: `${project.spec.width}x${project.spec.height} @ ${project.spec.fps}fps`,
    next: ['node bin/render.mjs --template projects/' + path.basename(projectDir) + ' --frames 60,360 --out out/check.png'],
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`[nutcut] ${error.message}`)
  process.exit(1)
}
