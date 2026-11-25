#!/usr/bin/env node
/**
 * 修改已有项目的视频规格。
 *
 *   node bin/set-spec.mjs --project projects/<id> \
 *     --orientation landscape --quality 1080p --fps 30 --duration 30 --audio source
 *
 * 改了尺寸/画幅后，layoutAdapted 会自动重置为 false，必须重新适配版式。
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSpec, expectedSpecQuestions } from '../src/spec.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/set-spec.mjs --project projects/<id> --orientation <portrait|landscape|square> --quality 1080p --fps 30 --duration 30')
  const projectDir = path.resolve(projectArg)
  const projectFile = path.join(projectDir, 'project.json')
  const project = readJson(projectFile)
  if (!project) throw new Error(`缺少 project.json：${projectFile}`)

  const current = project.spec || {}
  const orientation = arg('orientation', current.orientation)
  const sizeArg = arg('size')
  const explicitQuality = arg('quality')
  const keepDimensions = !sizeArg && !explicitQuality && !arg('width') && !arg('height') && orientation === current.orientation
  const qualityArg = explicitQuality || (keepDimensions ? (current.quality || '') : '1080p')
  const normalized = normalizeSpec({
    orientation,
    size: sizeArg,
    quality: qualityArg,
    width: sizeArg ? undefined : (keepDimensions ? current.width : arg('width')),
    height: sizeArg ? undefined : (keepDimensions ? current.height : arg('height')),
    fps: arg('fps', current.fps || 30),
    duration: arg('duration', current.duration),
    platform: arg('platform', current.platform || ''),
    audio: arg('audio', current.audio || 'undecided'),
  })
  if (!normalized.ok) {
    console.error(`\n[规格未确认] ${normalized.error}\n`)
    for (const question of normalized.questions || expectedSpecQuestions()) console.error(`  - ${question}`)
    process.exit(1)
  }
  const spec = normalized.spec
  const dimensionsChanged = Number(current.width) !== spec.width || Number(current.height) !== spec.height
  const layoutAdapted = dimensionsChanged ? false : Boolean(project.layoutAdapted)

  project.spec = spec
  project.duration = spec.duration
  project.layoutAdapted = layoutAdapted
  const templateMeta = readJson(path.join('templates', project.template || '', 'template.json'))
  if (templateMeta) project.subtitle = `${templateMeta.category || '短片'} · ${spec.orientationLabel} · ${spec.duration} 秒`
  project.updatedAt = new Date().toISOString()
  writeJson(projectFile, project)

  const motionFile = path.join(projectDir, 'motion.json')
  const motion = readJson(motionFile)
  if (motion) {
    motion.output = { ...(motion.output || {}), width: spec.width, height: spec.height, fps: spec.fps, duration: spec.duration }
    writeJson(motionFile, motion)
  }

  const briefFile = path.join(projectDir, 'brief.json')
  const brief = readJson(briefFile)
  if (brief) {
    brief.spec = spec
    brief.format = `${spec.orientationLabel} ${spec.width}×${spec.height} · ${spec.duration} 秒`
    writeJson(briefFile, brief)
  }

  const scriptFile = path.join(projectDir, 'script.json')
  const script = readJson(scriptFile)
  if (script) {
    script.spec = spec
    if (templateMeta) script.subtitle = project.subtitle
    writeJson(scriptFile, script)
  }

  console.log(JSON.stringify({
    ok: true,
    project: projectArg,
    spec,
    needsLayoutAdaptation: !layoutAdapted,
    next: layoutAdapted
      ? []
      : [`node bin/adapt-layout.mjs --project ${projectArg.replace(/\\/g, '/')} --confirm`],
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`[nutcut] ${error.message}`)
  process.exit(1)
}
