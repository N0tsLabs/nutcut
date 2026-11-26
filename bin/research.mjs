#!/usr/bin/env node
/**
 * 记录/检查模糊方向的联网调研。
 *
 *   node bin/research.mjs --project projects/<id> --check
 *   node bin/research.mjs --project projects/<id> --init
 *
 * research.json 由 Agent 在真实联网搜索后填写，不要编造来源。
 */
import fs from 'node:fs'
import path from 'node:path'
import { validateResearch } from '../src/research.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) { return process.argv.includes(`--${name}`) }
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/research.mjs --project projects/<id> [--check|--init]')
  const projectDir = path.resolve(projectArg)
  const file = path.join(projectDir, 'research.json')
  const project = readJson(path.join(projectDir, 'project.json'))
  if (!project) throw new Error(`缺少 project.json：${projectDir}`)
  if (project.mode !== 'research') throw new Error('当前项目不是 research 模式；先运行 node bin/route.mjs --mode research')

  if (has('init') && !fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      question: '',
      queries: [],
      sources: [],
      findings: [],
      audienceInsights: [],
      angles: [],
      assets: [],
      updatedAt: new Date().toISOString(),
    }, null, 2) + '\n', 'utf8')
    console.log(`[research] 已创建 ${path.relative(process.cwd(), file)}`)
  }

  const result = validateResearch(file)
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, file: path.relative(process.cwd(), file).replace(/\\/g, '/'), sources: result.sources, findings: result.findings, angles: result.angles }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`[research] ${error.message}`)
  process.exit(1)
}
