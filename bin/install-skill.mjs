#!/usr/bin/env node
/**
 * 把 NutCut 技能安装到 Agent 的技能目录。
 *
 *   node bin/install-skill.mjs --target opencode
 *   node bin/install-skill.mjs --target claude
 *   node bin/install-skill.mjs --target project
 *   node bin/install-skill.mjs --target all --force
 *   node bin/install-skill.mjs --dest D:/some-agent/skills/nutcut
 *
 * 技能源文件：skills/nutcut/SKILL.md
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const SOURCE = path.join(ROOT, 'skills', 'nutcut')

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) {
  return process.argv.includes(`--${name}`)
}

function targets() {
  return {
    opencode: path.join(os.homedir(), '.config', 'opencode', 'skills', 'nutcut'),
    claude: path.join(os.homedir(), '.claude', 'skills', 'nutcut'),
    agents: path.join(os.homedir(), '.agents', 'skills', 'nutcut'),
    project: path.join(ROOT, '.opencode', 'skills', 'nutcut'),
    codex: path.join(os.homedir(), '.codex', 'skills', 'nutcut'),
  }
}

function install(dest, { force = false, dryRun = false, label = '', cleanLegacy = false } = {}) {
  if (!fs.existsSync(path.join(SOURCE, 'SKILL.md'))) {
    throw new Error(`找不到技能源文件：${path.join(SOURCE, 'SKILL.md')}`)
  }
  const exists = fs.existsSync(dest)
  if (exists && !force) {
    return { ok: false, dest, label, skipped: true, reason: '已存在，加 --force 覆盖' }
  }
  if (dryRun) {
    return { ok: true, dest, label, dryRun: true }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (exists) fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(SOURCE, dest, { recursive: true })
  if (cleanLegacy) {
    for (const legacy of ['motion-smith', 'template-smith', 'voice-clone']) {
      fs.rmSync(path.join(path.dirname(dest), legacy), { recursive: true, force: true })
    }
  }
  return { ok: true, dest, label }
}

function main() {
  const targetName = String(arg('target', 'opencode')).toLowerCase()
  const custom = arg('dest')
  const force = has('force')
  const dryRun = has('dry-run')
  const cleanLegacy = has('clean-legacy')
  const all = targets()

  let jobs = []
  if (custom) {
    jobs = [{ label: 'custom', dest: path.resolve(custom) }]
  } else if (targetName === 'all') {
    jobs = ['opencode', 'claude', 'agents'].map((name) => ({ label: name, dest: all[name] }))
  } else if (all[targetName]) {
    jobs = [{ label: targetName, dest: all[targetName] }]
  } else {
    console.error(`未知 target：${targetName}`)
    console.error(`可用：${Object.keys(all).join(' / ')} / all，或 --dest <目录>`)
    process.exit(1)
  }

  console.log(`[nutcut] skill: ${path.relative(ROOT, SOURCE)}`)
  for (const job of jobs) {
    const result = install(job.dest, { force, dryRun, label: job.label, cleanLegacy })
    if (!result.ok) {
      console.log(`[skip] ${job.label.padEnd(8)} ${result.dest}  (${result.reason})`)
      continue
    }
    console.log(`[${dryRun ? 'plan' : 'ok  '}] ${job.label.padEnd(8)} ${result.dest}`)
  }
  if (dryRun) console.log('\n[dry-run] 没有写入文件。')
  else {
    console.log('\n下一步：重启 Agent，或让它读技能；使用项目时把仓库路径一起给它。')
    console.log('  node bin/doctor.mjs')
    console.log('  node bin/status.mjs --project projects/<id>')
  }
}

try {
  main()
} catch (error) {
  console.error(`[nutcut] 安装失败：${error.message}`)
  process.exit(1)
}
