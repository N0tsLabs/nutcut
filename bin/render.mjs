#!/usr/bin/env node
/**
 * OpenMotion renderer.
 *
 *   node bin/render.mjs --template templates/kinetic-title --out out/demo.mp4
 *   node bin/render.mjs --template ... --params params.json --preset dark
 *   node bin/render.mjs --template ... --stills 5
 *
 * Deterministic HTML frames -> PNG -> MP4. No network, no account, no key.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { projectRenderBlock } from '../src/spec.mjs'
import { approvalBlock } from '../src/approval.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function has(name) {
  return process.argv.includes(`--${name}`)
}

function fail(message) {
  console.error(`[openmotion] ${message}`)
  process.exit(1)
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
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  fail('找不到 Chrome/Edge；设置 CHROME_PATH 指向浏览器可执行文件')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

function parseParams(raw) {
  if (!raw) return {}
  if (fs.existsSync(raw)) return readJson(raw)
  try {
    return JSON.parse(raw)
  } catch {
    fail(`--params 既不是文件也不是合法 JSON：${raw}`)
  }
}

function resolvePreset(templateDir, manifest, name) {
  if (!name) return {}
  const direct = name.endsWith('.json') ? path.resolve(name) : path.join(templateDir, 'presets', `${name}.json`)
  if (!fs.existsSync(direct)) fail(`找不到 preset：${direct}`)
  return readJson(direct)
}

async function main() {
  const templateArg = arg('template')
  if (!templateArg) fail('用法：node bin/render.mjs --template <dir> [--params file] [--preset name] [--out file] [--stills N]')
  const templateDir = path.resolve(templateArg)
  const manifestPath = path.join(templateDir, 'motion.json')
  if (!fs.existsSync(manifestPath)) fail(`缺少 motion.json：${manifestPath}`)
  const manifest = readJson(manifestPath)
  if (manifest.format !== 'openmotion-template') fail(`不支持的 format：${manifest.format}`)
  if (manifest.runtime?.profile !== 'html/1') fail(`不支持的 runtime.profile：${manifest.runtime?.profile}`)

  // 直接渲染 projects/<id> 时，先检查规格和版式适配；渲染 templates/ 不受影响。
  const projectFile = path.join(templateDir, 'project.json')
  if (fs.existsSync(projectFile) && !has('allow-layout-mismatch')) {
    const projectData = readJson(projectFile)
    const blocked = projectRenderBlock(projectData)
    if (blocked) fail(`${blocked}（确需跳过加 --allow-layout-mismatch）`)
    if (!has('frames') && !has('stills')) {
      const pending = approvalBlock(projectData)
      if (pending) fail(pending)
    }
  }

  const schemaPath = path.join(templateDir, manifest.params?.schema ?? 'params.schema.json')
  const schema = fs.existsSync(schemaPath) ? readJson(schemaPath) : null

  const presetName = arg('preset') || (manifest.params?.defaultPreset ? path.basename(manifest.params.defaultPreset, '.json') : '')
  const preset = resolvePreset(templateDir, manifest, presetName)
  const overrides = parseParams(arg('params'))
  const inputs = { ...preset, ...overrides }

  for (const key of schema?.required ?? []) {
    if (inputs[key] === undefined) fail(`缺少必填参数：${key}`)
  }

  const width = Number(arg('width', manifest.output?.width ?? 1920))
  const height = Number(arg('height', manifest.output?.height ?? 1080))
  const fps = Number(arg('fps', manifest.output?.fps ?? 30))
  const duration = Number(arg('duration', manifest.output?.duration ?? 6))
  const entry = path.join(templateDir, manifest.runtime.entry)
  if (!fs.existsSync(entry)) fail(`缺少入口：${entry}`)

  const framesArg = arg('frames', '')
  const stillsCount = framesArg ? framesArg.split(',').filter(Boolean).length : Number(arg('stills', '0'))
  const outFile = arg('out', path.join('out', `${manifest.id}${stillsCount ? '-stills' : ''}.${stillsCount ? 'png' : 'mp4'}`))
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-color-profile=srgb'],
  })

  let frameDir = null
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    const requests = []
    page.on('request', (request) => {
      const url = request.url()
      if (!url.startsWith('file:') && !url.startsWith('data:') && !url.startsWith('blob:')) requests.push(url)
    })
    await page.goto(pathToFileURL(entry).href, { waitUntil: 'load' })
    await page.waitForFunction('window.__ready === true || typeof window.renderFrame === "function"', { timeout: 20000 })

    if (manifest.runtime?.network === false && requests.length) {
      fail(`模板声明 network:false，但发起了网络请求：${requests.slice(0, 3).join(', ')}`)
    }

    const total = Math.max(1, Math.round(duration * fps))
    const renderFrame = async (frame) => {
      await page.evaluate(
        ({ frame, inputs }) => window.renderFrame(frame, inputs),
        { frame, inputs },
      )
    }

    if (stillsCount > 0) {
      const indices = framesArg
        ? framesArg.split(',').map((value) => Math.max(0, Math.min(total - 1, Number(value.trim())))).filter((value) => Number.isFinite(value))
        : Array.from({ length: stillsCount }, (_, i) => Math.round((i / Math.max(1, stillsCount - 1)) * (total - 1)))
      const files = []
      for (const frame of indices) {
        await renderFrame(frame)
        const file = path.join(path.dirname(path.resolve(outFile)), `${manifest.id}-${String(frame).padStart(5, '0')}.png`)
        await page.screenshot({ path: file })
        files.push(file)
      }
      console.log(JSON.stringify({ ok: true, mode: 'stills', files, width, height, frames: indices }, null, 2))
      return
    }

    frameDir = path.join(path.dirname(path.resolve(outFile)), `.frames-${manifest.id}-${Date.now()}`)
    fs.mkdirSync(frameDir, { recursive: true })
    for (let frame = 0; frame < total; frame += 1) {
      await renderFrame(frame)
      await page.screenshot({ path: path.join(frameDir, `${String(frame).padStart(5, '0')}.png`) })
      if (frame % Math.max(1, Math.round(fps)) === 0) console.error(`[openmotion] ${frame}/${total}`)
    }

    const ffmpeg = spawnSync('ffmpeg', [
      '-y', '-v', 'error',
      '-framerate', String(fps),
      '-i', path.join(frameDir, '%05d.png'),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      path.resolve(outFile),
    ], { encoding: 'utf8' })
    if (ffmpeg.status !== 0) fail(`ffmpeg 失败：${(ffmpeg.stderr ?? '').slice(-600)}`)

    console.log(JSON.stringify({
      ok: true,
      mode: 'video',
      template: manifest.id,
      output: path.resolve(outFile),
      width,
      height,
      fps,
      duration,
      frames: total,
      bytes: fs.statSync(path.resolve(outFile)).size,
      inputs,
    }, null, 2))
  } finally {
    await browser.close()
    if (frameDir) fs.rmSync(frameDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
