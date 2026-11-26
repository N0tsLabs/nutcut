#!/usr/bin/env node
/**
 * 判断视频走哪条路径。
 *
 *   node bin/route.mjs --project projects/<id> --mode research --reason "用户只给了模糊方向"
 *   node bin/route.mjs --project projects/<id> --mode materials --reason "用户给了口播/产品/素材"
 *
 * research：模糊方向，必须先联网调研，再 brief/style/script。
 * materials：已有明确素材，跳过调研，直接 brief/style/script。
 */
import fs from 'node:fs'
import path from 'node:path'

const MODES = ['research', 'materials']

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function main() {
  const projectArg = arg('project')
  const mode = String(arg('mode', '')).toLowerCase()
  if (!projectArg) throw new Error('用法：node bin/route.mjs --project projects/<id> --mode <research|materials> [--reason "..."]')
  if (!MODES.includes(mode)) throw new Error(`--mode 只能是：${MODES.join(' / ')}`)

  const projectDir = path.resolve(projectArg)
  const file = path.join(projectDir, 'project.json')
  const project = readJson(file)
  if (!project) throw new Error(`缺少 project.json：${file}`)
  if (!project.spec?.confirmed) throw new Error('规格还没确认，先确认 project.spec')

  const now = new Date().toISOString()
  project.mode = mode
  project.route = {
    mode,
    reason: String(arg('reason', '')).trim() || null,
    decidedAt: now,
  }
  project.approvals = {
    ...(project.approvals || {}),
    spec: true,
    research: mode === 'research' ? false : true,
    brief: false,
    style: false,
    script: false,
    keyframes: false,
    updatedAt: now,
    confirmedBy: null,
  }
  project.pendingQuestion = null
  project.updatedAt = now
  writeJson(file, project)

  console.log(JSON.stringify({
    ok: true,
    project: projectArg,
    mode,
    next: mode === 'research'
      ? [
          '联网搜索并记录至少 3 个来源到 research.json',
          'node bin/research.mjs --project ' + projectArg + ' --check',
          'node bin/confirm.mjs --project ' + projectArg + ' --step research',
        ]
      : [
          '直接分析已有素材，写 brief 和 style.json',
          'node bin/confirm.mjs --project ' + projectArg + ' --step brief',
        ],
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`[route] ${error.message}`)
  process.exit(1)
}
