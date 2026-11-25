#!/usr/bin/env node
/**
 * Remotion 渲染（可选引擎）。
 *
 *   node bin/render-remotion.mjs --template templates/talk-frame --out out/talk-frame-remotion.mp4
 *   node bin/render-remotion.mjs --composition DataConsole --out out/data.mp4 --props '{"title":"数据"}'
 *   node bin/render-remotion.mjs --template templates/photo-story --still 120 --out out/photo.png
 *
 * 和 bin/render.mjs 并存：HTML 模板仍是默认引擎，这里只渲染已经迁到 Remotion 的 9 套版式。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectRenderBlock } from '../src/spec.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CACHE = path.join(ROOT, '.cache', 'remotion-bundle')

// Windows 沙箱 / 杀软有时会拒绝 Remotion 自带 ffmpeg 写入系统 %TEMP%，
// 统一改用项目内 .cache/tmp，避免渲染到一半 Permission denied。
const TEMP_DIR = process.env.NUTCUT_TEMP_DIR || path.join(ROOT, '.cache', 'tmp')
fs.mkdirSync(TEMP_DIR, { recursive: true })
process.env.TEMP = TEMP_DIR
process.env.TMP = TEMP_DIR

const { bundle } = await import('@remotion/bundler')
const { renderMedia, renderStill, selectComposition } = await import('@remotion/renderer')

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function has(name) {
  return process.argv.includes(`--${name}`)
}

function fail(message) {
  console.error(`[remotion] ${message}`)
  process.exit(1)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

function newestSource(dir) {
  let newest = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) newest = Math.max(newest, newestSource(file))
    else if (/\.(tsx?)$/.test(entry.name) || (entry.name.endsWith('.json') && !entry.name.startsWith('tsconfig'))) newest = Math.max(newest, fs.statSync(file).mtimeMs)
  }
  return newest
}

function findBrowser() {
  const candidates = [
    process.env.REMOTION_BROWSER,
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function parseProps(raw) {
  if (!raw) return {}
  if (fs.existsSync(raw)) return readJson(raw)
  try {
    return JSON.parse(raw)
  } catch {
    fail(`--props 既不是文件也不是合法 JSON：${raw}`)
  }
}

function templateProps(templateDir) {
  const meta = readJson(path.join(templateDir, 'template.json'))
  const presetFile = path.join(templateDir, 'presets', 'default.json')
  const preset = fs.existsSync(presetFile) ? readJson(presetFile) : {}
  const props = {
    palette: meta.palette || {},
    ...(meta.remotion?.props || {}),
  }
  if (!props.title && preset.title) props.title = preset.title
  if (!props.subtitle && preset.subtitle) props.subtitle = preset.subtitle
  return props
}

async function serveUrl() {
  const stale = has('rebuild') || !fs.existsSync(path.join(CACHE, 'index.html')) || fs.statSync(path.join(CACHE, 'index.html')).mtimeMs < newestSource(path.join(ROOT, 'remotion'))
  if (!stale) return { url: CACHE, reused: true }
  fs.mkdirSync(CACHE, { recursive: true })
  const url = await bundle({
    entryPoint: path.join(ROOT, 'remotion', 'index.ts'),
    outDir: CACHE,
    publicDir: null,
    rootDir: ROOT,
  })
  return { url, reused: false }
}

async function main() {
  const templateArg = arg('template')
  const compositionId = arg('composition') || (templateArg ? readJson(path.join(path.resolve(templateArg), 'template.json')).remotion?.composition : '')
  if (!compositionId) fail('用法：node bin/render-remotion.mjs --template templates/<id> | --composition <id> [--props file|json] [--out file] [--still N]')

  if (templateArg) {
    const projectFile = path.join(path.resolve(templateArg), 'project.json')
    if (fs.existsSync(projectFile) && !has('allow-layout-mismatch')) {
      const blocked = projectRenderBlock(readJson(projectFile))
      if (blocked) fail(`${blocked}（确需跳过加 --allow-layout-mismatch）`)
    }
  }

  const inputProps = {
    ...(templateArg ? templateProps(path.resolve(templateArg)) : {}),
    ...parseProps(arg('props')),
  }

  const browserExecutable = arg('browser') || findBrowser()
  const { url, reused } = await serveUrl()
  console.log(`[remotion] bundle ${reused ? '复用' : '已生成'}：${path.relative(ROOT, CACHE)}`)

  const composition = await selectComposition({
    serveUrl: url,
    id: compositionId,
    inputProps,
    browserExecutable,
  })

  const isStill = has('still') || arg('still') !== ''
  const outFile = path.resolve(arg('out', path.join('out', `${compositionId}${isStill ? '.png' : '.mp4'}`)))
  fs.mkdirSync(path.dirname(outFile), { recursive: true })

  if (isStill) {
    const frame = Number(arg('still', '0')) || 0
    await renderStill({
      serveUrl: url,
      composition,
      inputProps,
      output: outFile,
      frame,
      browserExecutable,
      overwrite: true,
    })
    console.log(JSON.stringify({ ok: true, mode: 'still', composition: compositionId, frame, out: outFile, width: composition.width, height: composition.height }, null, 2))
    return
  }

  let lastLogged = -1
  await renderMedia({
    serveUrl: url,
    composition,
    inputProps,
    codec: 'h264',
    outputLocation: outFile,
    browserExecutable,
    overwrite: true,
    logLevel: arg('log', 'info'),
    concurrency: arg('concurrency') ? Number(arg('concurrency')) : null,
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 100)
      if (percent !== lastLogged && percent % 10 === 0) {
        lastLogged = percent
        console.error(`[remotion] ${percent}%`)
      }
    },
  })

  console.log(JSON.stringify({ ok: true, mode: 'video', composition: compositionId, out: outFile, width: composition.width, height: composition.height, durationInFrames: composition.durationInFrames, fps: composition.fps }, null, 2))
}

main().catch((error) => fail(error.stack || error.message))
