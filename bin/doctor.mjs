#!/usr/bin/env node
/**
 * 环境检查。新 Agent clone 仓库后先跑这个。
 *
 *   node bin/doctor.mjs
 *   node bin/doctor.mjs --json
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function has(name) { return process.argv.includes(`--${name}`) }
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function envKeys() {
  const file = path.join(process.cwd(), '.env')
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.split('=')[0].trim()).filter((line) => line && !line.startsWith('#'))
}
function command(name) {
  const result = spawnSync(name, ['-version'], { encoding: 'utf8' })
  return { ok: result.status === 0, version: String(result.stdout || result.stderr || '').split('\n')[0].slice(0, 80) }
}
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}
function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) count += countFiles(full, ext)
    else if (ext.test(entry.name)) count += 1
  }
  return count
}

function main() {
  const keys = envKeys()
  const voice = readJson(path.join('voices', 'me', 'profile.json'))
  const music = readJson(path.join('library', 'music', 'catalog.json'), { tracks: [] })
  const sfx = readJson(path.join('library', 'sfx', 'catalog.json'), { tracks: [] })
  const templates = fs.existsSync('templates') ? fs.readdirSync('templates', { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join('templates', entry.name, 'template.json'))).length : 0
  const projects = fs.existsSync('projects') ? fs.readdirSync('projects', { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join('projects', entry.name, 'project.json'))).length : 0
  const checks = [
    { name: 'Node', ok: Number(process.version.slice(1).split('.')[0]) >= 20, detail: process.version },
    { name: 'FFmpeg', ok: command('ffmpeg').ok, detail: command('ffmpeg').version },
    { name: 'FFprobe', ok: command('ffprobe').ok, detail: command('ffprobe').version },
    { name: '浏览器', ok: Boolean(findBrowser()), detail: findBrowser() || '未找到 Chrome/Edge，设置 CHROME_PATH' },
    { name: '依赖', ok: fs.existsSync('node_modules'), detail: fs.existsSync('node_modules') ? '已安装' : '运行 npm install' },
    { name: '声音档案', ok: Boolean(voice), required: false, detail: voice ? `${voice.id || 'me'} · ${voice.duration || '?'} 秒` : '缺少 voices/me/profile.json；用原声或无配音项目时可忽略' },
    { name: '参考音频', ok: fs.existsSync(path.join('voices', 'me', voice?.reference || 'reference.wav')), required: false, detail: voice?.reference || 'reference.wav' },
    { name: 'MiniMax 克隆 Key', ok: keys.includes('MINIMAX_API_KEY'), required: false, detail: keys.includes('MINIMAX_API_KEY') ? '已配置' : '缺少 MINIMAX_API_KEY（只在克隆时用）' },
    { name: 'MiniMax 套餐 Key', ok: keys.includes('MINIMAX_PLAN_KEY'), required: false, detail: keys.includes('MINIMAX_PLAN_KEY') ? '已配置' : '缺少 MINIMAX_PLAN_KEY（TTS / 生图）' },
    { name: 'BGM 曲库', ok: (music.tracks || []).length > 0, required: false, detail: `${(music.tracks || []).length} 首` },
    { name: '音效库', ok: (sfx.tracks || []).length > 0, required: false, detail: `${(sfx.tracks || []).length} 个` },
    { name: '模板', ok: templates > 0, detail: `${templates} 套` },
    {
      name: 'Remotion',
      ok: fs.existsSync('node_modules/remotion') && fs.existsSync('node_modules/@remotion/player'),
      required: false,
      detail: fs.existsSync('node_modules/remotion')
        ? fs.existsSync('console/ui/remotion-player.js')
          ? 'Player 已打包 · 9 套版式'
          : 'Player 未打包，启动中控台会自动打包'
        : '缺少 remotion，运行 npm install',
    },
    { name: '项目', ok: true, detail: `${projects} 个` },
  ]
  const strict = has('strict')
  const failed = checks.filter((check) => !check.ok && (check.required !== false || strict))
  const warnings = checks.filter((check) => !check.ok && check.required === false && !strict)
  const result = {
    ok: failed.length === 0,
    checks,
    failed: failed.map((check) => check.name),
    warnings: warnings.map((check) => check.name),
  }
  if (has('json')) { console.log(JSON.stringify(result, null, 2)); return }
  console.log('\nNutCut 环境检查\n')
  for (const check of checks) {
    const mark = check.ok ? '✓' : check.required === false ? '!' : '✗'
    console.log(`${mark} ${check.name.padEnd(12)} ${check.detail}`)
  }
  console.log(`\n${failed.length ? `${failed.length} 项必需检查未通过` : '必需检查全部通过，可以开始。'}`)
  if (warnings.length) console.log(`另有 ${warnings.length} 项可选能力未配置：${warnings.map((check) => check.name).join('、')}`)
  console.log('')
  if (failed.length) process.exitCode = 1
}

main()
