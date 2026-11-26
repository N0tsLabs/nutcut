#!/usr/bin/env node
/**
 * 标记用户已经确认某个阶段。
 *
 *   node bin/confirm.mjs --project projects/<id> --step brief --note "方向和风格通过"
 *   node bin/confirm.mjs --project projects/<id> --step script
 *   node bin/confirm.mjs --project projects/<id> --step keyframes
 *
 * 只应由 Agent 在用户明确确认后执行；不要自己替用户确认。
 */
import fs from 'node:fs'
import path from 'node:path'
import { validateResearch } from '../src/research.mjs'

const STEPS = ['research', 'brief', 'style', 'script', 'keyframes']

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
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function main() {
  const projectArg = arg('project')
  const step = String(arg('step', '')).toLowerCase()
  if (!projectArg) throw new Error('用法：node bin/confirm.mjs --project projects/<id> --step <research|brief|style|script|keyframes> [--note "..."]')
  if (!STEPS.includes(step)) throw new Error(`--step 只能是：${STEPS.join(' / ')}`)

  const projectDir = path.resolve(projectArg)
  const projectFile = path.join(projectDir, 'project.json')
  const project = readJson(projectFile)
  if (!project) throw new Error(`缺少 project.json：${projectFile}`)
  if (!project.spec?.confirmed) throw new Error('规格还没确认，先补 project.spec')
  if (!project.mode) throw new Error('还没判断路径，先运行 node bin/route.mjs --project <项目> --mode research|materials')

  if (step === 'research') {
    if (project.mode !== 'research') throw new Error('当前是 materials 模式，不需要 research 确认')
    const result = validateResearch(path.join(projectDir, 'research.json'))
    if (!result.ok) throw new Error(result.errors.join('；'))
  }
  if (step === 'brief' && !fs.existsSync(path.join(projectDir, 'brief.json'))) {
    throw new Error('缺少 brief.json，先写选题/受众/角度')
  }
  if (step === 'style') {
    const styleFile = path.join(projectDir, 'style.json')
    if (!fs.existsSync(styleFile) && !project.template) throw new Error('缺少 style.json 或 project.template，先确定风格/模板')
  }
  if (step === 'script') {
    const script = readJson(path.join(projectDir, 'script.json'))
    if (!script?.lines?.length) throw new Error('script.json 还没有逐句文案')
  }
  if (step === 'keyframes' && !has('force')) {
    const keyframeDir = path.join('out', project.id, 'keyframes')
    const hasFrames = fs.existsSync(keyframeDir) && fs.readdirSync(keyframeDir).some((file) => /\.(png|jpe?g)$/i.test(file))
    const hasPoster = fs.existsSync(path.join('out', project.id, 'poster.png'))
    if (!hasFrames && !hasPoster) throw new Error('还没找到关键帧；先渲关键帧再确认，或加 --force 只记录确认')
  }

  const now = new Date().toISOString()
  const approvals = {
    ...(project.approvals || {}),
    spec: true,
    [step]: true,
    updatedAt: now,
    confirmedBy: 'user',
    history: [
      ...((project.approvals?.history) || []),
      { step, at: now, by: 'user', note: String(arg('note', '')).trim() || null },
    ],
  }
  project.approvals = approvals
  project.pendingQuestion = null
  project.updatedAt = now
  writeJson(projectFile, project)

  console.log(JSON.stringify({ ok: true, project: projectArg, step, approvals }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`[confirm] ${error.message}`)
  process.exit(1)
}
