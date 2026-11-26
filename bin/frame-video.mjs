#!/usr/bin/env node
/**
 * 口播画中画成片：渲染模板层 → 合成原视频窗口 → 输出成片。
 *
 *   node bin/frame-video.mjs --project projects/hand-cream-talk
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { projectRenderBlock } from '../src/spec.mjs'
import { approvalBlock } from '../src/approval.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) {
  return process.argv.includes(`--${name}`)
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function rel(file) { return path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/') }
function run(command, args, label) {
  console.log(`\n[nutcut] ${label}`)
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${label}失败`)
}
function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/frame-video.mjs --project projects/<id> [--template templates/talk-frame]')
  const projectDir = path.resolve(projectArg)
  const id = path.basename(projectDir)
  const project = readJson(path.join(projectDir, 'project.json'), null)
  if (!project) throw new Error(`缺少 project.json：${projectDir}`)
  const blocked = projectRenderBlock(project)
  if (blocked && !has('allow-layout-mismatch')) throw new Error(blocked)
  const pending = approvalBlock(project)
  if (pending && !has('allow-unconfirmed')) throw new Error(pending)
  const style = readJson(path.join(projectDir, 'style.json'), null)
  if (!style) console.error('[nutcut] 没有 style.json；默认按 frame-motion 制作。建议先和用户确认风格。')
  if (style?.mode && style.mode !== 'frame-motion') {
    throw new Error(`style.json 选择的是 ${style.mode}，不是 frame-motion；请走对应流程`)
  }
  const templateDir = path.resolve(arg('template', 'templates/talk-frame'))
  const manifest = readJson(path.join(templateDir, 'motion.json'), null)
  if (!manifest) throw new Error(`缺少模板：${templateDir}`)
  const frameFile = path.resolve(arg('params', path.join(projectDir, 'frame.json')))
  const frame = readJson(frameFile, null)
  if (!frame) throw new Error(`缺少画中画参数：${frameFile}`)
  const source = path.resolve(project.assets?.source || frame.source || '')
  if (!source || !fs.existsSync(source)) throw new Error(`缺少原始视频：${source}`)
  const outDir = path.resolve(arg('outdir', path.join('out', id)))
  const layer = path.join(outDir, 'frame-layer.mp4')
  const out = path.resolve(arg('out', path.join(outDir, 'film.mp4')))
  fs.mkdirSync(outDir, { recursive: true })
  const width = Number(arg('width', manifest.output?.width || 720))
  const height = Number(arg('height', manifest.output?.height || 1280))
  const fps = Number(arg('fps', manifest.output?.fps || 30))
  const duration = Number(arg('duration', frame.duration || project.duration || 36.55))

  run('node', [
    'bin/render.mjs',
    '--template', templateDir,
    '--params', frameFile,
    '--out', layer,
    '--duration', String(duration),
    '--width', String(width),
    '--height', String(height),
    '--fps', String(fps),
  ], '1/2 渲染模板层')

  run('node', [
    'bin/compose-frame.mjs',
    '--layer', layer,
    '--source', source,
    '--frame', frameFile,
    '--out', out,
    '--duration', String(duration),
    ...(arg('music') ? ['--music', arg('music')] : []),
  ], '2/2 合成原视频窗口')

  run('ffmpeg', ['-y', '-v', 'error', '-i', out, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', path.join(outDir, 'audio.wav')], '导出成片音轨')

  const info = readJson(path.join(outDir, 'frame-report.json'), {})
  const next = {
    ...project,
    kind: 'video-frame',
    status: 'review',
    stage: 'review',
    template: project.template || manifest.id,
    duration: Number(info.duration || duration),
    updatedAt: new Date().toISOString(),
    assets: {
      ...(project.assets || {}),
      video: rel(out),
      poster: rel(path.join(outDir, 'poster.png')),
      source: rel(source),
      frame: rel(frameFile),
      layer: rel(layer),
      audio: rel(path.join(outDir, 'audio.wav')),
      ...(style ? { style: rel(path.join(projectDir, 'style.json')) } : {}),
    },
    scenes: (frame.captions || []).map((caption, index) => ({
      scene: `s${index + 1}`,
      line: String(index + 1).padStart(2, '0'),
      start: caption.start,
      end: caption.end,
      voiceStart: caption.start,
      voiceEnd: caption.end,
      duration: Number((caption.end - caption.start).toFixed(3)),
    })),
    tech: {
      ...(project.tech || {}),
      width,
      height,
      fps,
      frames: Math.round(Number(info.duration || duration) * fps),
      video: 'H.264',
      audio: 'AAC 48kHz stereo',
      loudness: '-16 LUFS',
      bytes: Number(info.bytes || 0),
    },
  }
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(next, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ ok: true, project: rel(path.join(projectDir, 'project.json')), video: rel(out), duration: next.duration, bytes: next.tech.bytes }, null, 2))
}
main()
