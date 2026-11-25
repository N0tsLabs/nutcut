#!/usr/bin/env node
/**
 * 打包 Remotion Player 到中控台。
 *
 *   node bin/remotion-build.mjs
 *   node bin/remotion-build.mjs --force
 *
 * 产物：console/ui/remotion-player.js（esbuild IIFE，自带 React）
 * 中控台模板页用它做 10 秒实时预览，不依赖 iframe。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const ENTRY = path.join(ROOT, 'remotion', 'entry.tsx')
const OUT = path.join(ROOT, 'console', 'ui', 'remotion-player.js')

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function newestSource() {
  let newest = 0
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (/\.(tsx?)$/.test(entry.name) || (entry.name.endsWith('.json') && !entry.name.startsWith('tsconfig'))) newest = Math.max(newest, fs.statSync(file).mtimeMs)
    }
  }
  walk(path.join(ROOT, 'remotion'))
  return newest
}

export function isPlayerStale() {
  if (!fs.existsSync(OUT)) return true
  return fs.statSync(OUT).mtimeMs < newestSource()
}

export async function buildPlayer() {
  const started = Date.now()
  await build({
    entryPoints: [ENTRY],
    outfile: OUT,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: { 'process.env.NODE_ENV': '"production"' },
    minify: true,
    legalComments: 'none',
    logLevel: 'silent',
  })
  const size = fs.statSync(OUT).size
  return { file: OUT, bytes: size, ms: Date.now() - started }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force')
  if (!force && !isPlayerStale()) {
    console.log('[remotion] player bundle 已是最新，跳过（--force 强制重打）')
  } else {
    const result = await buildPlayer()
    console.log(`[remotion] player bundle -> ${path.relative(ROOT, result.file)} (${(result.bytes / 1024).toFixed(0)} KB, ${result.ms}ms)`)
  }
}
