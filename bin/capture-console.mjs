#!/usr/bin/env node
/**
 * 从本地中控台抓真实截图，作为视频素材。
 *
 *   node console/server.mjs
 *   node bin/capture-console.mjs --out projects/<id>/assets/imported/ui
 *   node bin/capture-console.mjs --project <id> --preview data-console
 *
 * 产物：dashboard.png / templates.png / project.png / remotion-preview.png
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) {
  return process.argv.includes(`--${name}`)
}

function findBrowser() {
  const candidates = [
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

async function main() {
  const base = String(arg('url', 'http://127.0.0.1:4173')).replace(/\/$/, '')
  const projectId = arg('project')
  const previewId = arg('preview')
  const outDir = path.resolve(arg('out', projectId ? `projects/${projectId}/assets/imported/ui` : 'out/_captures'))
  const [width, height] = String(arg('viewport', '1440x1000')).split('x').map(Number)
  const browserPath = arg('browser') || findBrowser()
  if (!browserPath) throw new Error('找不到 Chrome/Edge；设置 CHROME_PATH 或用 --browser 指定')
  fs.mkdirSync(outDir, { recursive: true })

  let health
  try {
    health = await fetch(`${base}/api/health`).then((response) => response.json())
  } catch {
    throw new Error(`中控台没有启动：${base}。先运行 node console/server.mjs`)
  }
  if (!health.ok) throw new Error(`中控台健康检查失败：${base}`)

  const browser = await puppeteer.launch({ executablePath: browserPath, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] })
  const files = []
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })

  const shot = async (name) => {
    const file = path.join(outDir, `${name}.png`)
    await page.screenshot({ path: file })
    files.push(file)
  }

  try {
    await page.goto(`${base}/#/`, { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 400))
    await shot('dashboard')

    await page.goto(`${base}/#/templates`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.template-card')
    await new Promise((resolve) => setTimeout(resolve, 400))
    await shot('templates')

    if (previewId) {
      await page.click(`[data-preview-template="${previewId}"]`)
      await page.waitForFunction(() => {
        const remotion = document.querySelector('#preview-remotion')
        const frame = document.querySelector('#preview-frame')
        return (remotion && !remotion.hidden && remotion.children.length > 0)
          || (frame && !frame.hidden && String(frame.src || '').includes('/media/templates/'))
      }, { timeout: 15000 })
      await new Promise((resolve) => setTimeout(resolve, 900))
      await shot('remotion-preview')
      await page.click('.preview-close').catch(() => {})
      await page.waitForFunction(() => document.querySelector('#template-preview')?.hidden === true, { timeout: 5000 }).catch(() => {})
    }

    if (projectId) {
      await page.goto(`${base}/#/p/${encodeURIComponent(projectId)}`, { waitUntil: 'networkidle2' })
      await page.waitForSelector('#project-body')
      await new Promise((resolve) => setTimeout(resolve, 700))
      await shot('project')
    }
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify({ ok: true, base, out: path.relative(process.cwd(), outDir).replace(/\\/g, '/'), files: files.map((file) => path.relative(process.cwd(), file).replace(/\\/g, '/')) }, null, 2))
}

main().catch((error) => {
  console.error(`[capture] ${error.message}`)
  process.exit(1)
})
