#!/usr/bin/env node
/**
 * MiniMax-H3-Image text-to-image.
 *
 *   node bin/image.mjs --project projects/ai-for-ordinary-people --name test-image \
 *     --prompt "一只橘猫趴在窗台上晒太阳，午后暖光，胶片质感"
 *
 * Defaults to MINIMAX_PLAN_KEY (Go plan). It never falls back to balance.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadEnv } from '../src/env.mjs'
import { generateImage, minimaxConfig } from '../src/minimax.mjs'

loadEnv()

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function has(name) {
  return process.argv.includes(`--${name}`)
}

function rel(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, '/')
}

function slug(value, fallback = 'image') {
  const cleaned = String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

async function save(url, b64, file) {
  if (b64) {
    fs.writeFileSync(file, Buffer.from(b64, 'base64'))
    return
  }
  if (!url) throw new Error('图片没有返回 url / b64_json')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`)
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
}

async function main() {
  const promptFile = arg('prompt-file')
  const prompt = promptFile ? fs.readFileSync(promptFile, 'utf8').trim() : arg('prompt')
  if (!prompt) throw new Error('用法：node bin/image.mjs --project projects/<id> --name test-image --prompt "..."')
  const projectArg = arg('project')
  const model = arg('model') || 'MiniMax-H3-Image'
  const size = arg('size') || '2720x1536'
  const n = Math.max(1, Math.min(10, Number(arg('n', '1'))))
  const keyType = arg('key', 'plan') === 'api' ? 'api' : 'plan'
  const name = slug(arg('name') || `image-${Date.now()}`, 'image')
  const outDir = projectArg
    ? path.resolve(projectArg, 'assets', 'generated')
    : path.resolve('out', 'images')
  const config = minimaxConfig()

  console.log(JSON.stringify({
    provider: 'minimax',
    baseUrl: config.baseUrl,
    model,
    size,
    n,
    keyType,
    hasPlanKey: config.hasPlanKey,
    outDir: rel(outDir),
    promptChars: Array.from(prompt).length,
  }, null, 2))

  if (has('dry-run')) return
  if (keyType === 'plan' && !config.hasPlanKey) {
    throw new Error('缺少 MINIMAX_PLAN_KEY：图片生成默认只走 Go 套餐，不会回退到余额')
  }

  const result = await generateImage({ prompt, model, size, n, outputFormat: 'png', keyType })
  fs.mkdirSync(outDir, { recursive: true })
  const files = []
  for (const item of result.items) {
    if (item.error) {
      console.warn(`[image] ${item.index} failed: ${item.error.code} ${item.error.message}`)
      continue
    }
    const suffix = result.items.length > 1 ? `-${item.index + 1}` : ''
    const file = path.join(outDir, `${name}${suffix}.png`)
    await save(item.url, item.b64, file)
    files.push(file)
    console.log(`[image] saved ${rel(file)}${item.revisedPrompt ? ` · ${item.revisedPrompt.slice(0, 120)}` : ''}`)
  }
  if (!files.length) throw new Error('没有任何图片生成成功')

  const meta = {
    provider: 'minimax',
    model,
    size,
    keyType,
    prompt,
    revisedPrompt: result.items[0]?.revisedPrompt || null,
    apiSize: result.items[0]?.size || size,
    outputFormat: result.outputFormat,
    usage: result.usage,
    requestId: result.requestId,
    createdAt: new Date().toISOString(),
    promptSha256: crypto.createHash('sha256').update(prompt).digest('hex'),
    files: files.map(rel),
  }
  const metaFile = path.join(outDir, `${name}.json`)
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ ok: true, files: files.map(rel), meta: rel(metaFile), usage: result.usage }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
