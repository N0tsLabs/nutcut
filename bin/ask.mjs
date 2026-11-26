#!/usr/bin/env node
/**
 * 让 Agent 显式停下来问用户。
 *
 *   node bin/ask.mjs --project projects/<id> --question "这条视频主要发哪个平台？" --options "抖音|视频号|B站"
 *   node bin/ask.mjs --project projects/<id> --clear
 *
 * 写入 project.pendingQuestion；status / produce 会把它当成阻塞项。
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) { return process.argv.includes(`--${name}`) }
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/ask.mjs --project projects/<id> --question "..." [--options "A|B"]，或 --clear')
  const file = path.resolve(projectArg, 'project.json')
  const project = readJson(file)
  if (!project) throw new Error(`缺少 project.json：${file}`)

  if (has('clear')) {
    project.pendingQuestion = null
    project.updatedAt = new Date().toISOString()
    writeJson(file, project)
    console.log(JSON.stringify({ ok: true, project: projectArg, pendingQuestion: null }, null, 2))
    return
  }

  const question = String(arg('question', '')).trim()
  if (!question) throw new Error('缺少 --question')
  const options = String(arg('options', '')).split('|').map((item) => item.trim()).filter(Boolean)
  const pendingQuestion = {
    question,
    options,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  project.pendingQuestion = pendingQuestion
  project.updatedAt = pendingQuestion.createdAt
  writeJson(file, project)
  console.log(JSON.stringify({ ok: true, project: projectArg, pendingQuestion }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`[ask] ${error.message}`)
  process.exit(1)
}
