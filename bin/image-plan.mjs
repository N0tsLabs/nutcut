#!/usr/bin/env node
/**
 * 按 brief.json 的 imagePlan 批量生成图片。
 *
 *   node bin/image-plan.mjs --project projects/<id> --dry-run
 *   node bin/image-plan.mjs --project projects/<id>
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

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
  if (!projectArg) throw new Error('用法：node bin/image-plan.mjs --project projects/<id> [--dry-run]')
  const projectDir = path.resolve(projectArg)
  const briefFile = path.join(projectDir, 'brief.json')
  const brief = readJson(briefFile)
  if (!brief) throw new Error(`缺少 brief.json：${briefFile}`)
  const plan = Array.isArray(brief.imagePlan) ? brief.imagePlan : []
  if (!plan.length) throw new Error('brief.json 没有 imagePlan')
  const limit = Number(arg('limit', '0')) || plan.length
  let done = 0
  const generatedImages = []

  for (let index = 0; index < plan.length && done < limit; index += 1) {
    const item = plan[index]
    if (!item.prompt) continue
    if (!has('force') && /已生成|done/i.test(String(item.status || ''))) continue
    const name = String(item.scene || `scene-${index + 1}`).replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]+/g, '-')
    const args = ['bin/image.mjs', '--project', projectArg, '--name', name, '--prompt', item.prompt]
    if (has('dry-run')) args.push('--dry-run')
    console.log(`[image-plan] ${name}`)
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', stdio: has('dry-run') ? 'inherit' : 'inherit' })
    if (result.status !== 0) {
      item.status = '失败'
      writeJson(briefFile, { ...brief, imagePlan: plan, updatedAt: new Date().toISOString() })
      console.error(`[image-plan] 失败：${name}`)
      continue
    }
    if (has('dry-run')) continue
    const file = path.join(projectDir, 'assets', 'generated', `${name}.png`)
    item.status = '已生成'
    item.file = path.relative(process.cwd(), file).replace(/\\/g, '/')
    item.generatedAt = new Date().toISOString()
    generatedImages.push({
      url: path.relative(path.join(projectDir, 'src'), file).replace(/\\/g, '/'),
      alt: String(item.alt || item.title || name),
    })
    writeJson(briefFile, { ...brief, imagePlan: plan, updatedAt: new Date().toISOString() })
    done += 1
  }

  if (generatedImages.length) {
    const presetFile = path.join(projectDir, 'presets', 'default.json')
    const preset = readJson(presetFile, {}) || {}
    const current = Array.isArray(preset.images) ? preset.images : []
    const urls = new Set(generatedImages.map((image) => image.url))
    preset.images = [...current.filter((image) => !urls.has(typeof image === 'string' ? image : image?.url)), ...generatedImages]
    writeJson(presetFile, preset)
    console.log(`[image-plan] 已写入 presets/default.json：${generatedImages.length} 张图片`)
  }

  console.log(JSON.stringify({ ok: true, generated: done, total: plan.length, images: generatedImages.length }, null, 2))
}

main()
