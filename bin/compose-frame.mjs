#!/usr/bin/env node
/**
 * 把口播视频放进模板画中画窗口，并混入原声 / BGM。
 *
 *   node bin/compose-frame.mjs --layer out/demo/frame-layer.mp4 --source talk.mp4 --frame frame.json --out out/demo/film.mp4
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function rel(file) { return path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/') }
function ensureDir(file) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }) }
function run(args, label) {
  const result = spawnSync('ffmpeg', ['-y', '-hide_banner', ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${label}失败：${(result.stderr || '').slice(-1200)}`)
  return result
}
function probeDuration(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  return Number((result.stdout || '0').trim())
}
function probeSize(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  const [width, height] = String(result.stdout || '').trim().split(',').map(Number)
  return { width: width || 480, height: height || 852 }
}

const layer = arg('layer')
const source = arg('source')
const frameFile = arg('frame')
if (!layer || !source || !frameFile) throw new Error('用法：node bin/compose-frame.mjs --layer <模板层.mp4> --source <原视频> --frame <frame.json> --out <成片.mp4>')
const frame = readJson(frameFile, {})
const video = frame.video || { x: 40, y: 220, width: 400, height: 710 }
const out = arg('out', path.join('out', 'frame-film.mp4'))
const duration = Number(arg('duration', frame.duration || probeDuration(source)))
const music = arg('music', 'library/music/openlofi/soft-gold-sky.mp3')
const sourceSize = probeSize(source)
ensureDir(out)

const inputs = ['-i', layer, '-i', source]
if (music && fs.existsSync(music)) inputs.push('-stream_loop', '-1', '-i', music)
const filter = []
const lb = frame.letterbox
if (lb && Number(lb.start) > 0.05 && Number(lb.end) > Number(lb.start) + 0.05) {
  const start = Number(lb.start)
  const end = Math.min(duration, Number(lb.end))
  const crop = lb.crop || { width: sourceSize.width, height: sourceSize.height, x: 0, y: 0 }
  const labels = []
  filter.push('[1:v]split=3[s0][s1][s2]')
  if (start > 0.05) {
    filter.push(`[s0]trim=start=0:end=${start},setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v0]`)
    labels.push('[v0]')
  }
  filter.push(`[s1]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,crop=trunc(${crop.width}/2)*2:trunc(${crop.height}/2)*2:${crop.x || 0}:${crop.y || 0},split=2[bg][fg]`)
  filter.push(`[bg]scale=${sourceSize.width}:${sourceSize.height}:force_original_aspect_ratio=increase,crop=${sourceSize.width}:${sourceSize.height},boxblur=24:2,eq=brightness=-0.10:saturation=0.92[bg2]`)
  filter.push(`[fg]scale=${sourceSize.width}:-2:flags=lanczos[fg2]`)
  filter.push(`[bg2][fg2]overlay=(W-w)/2:(H-h)/2,fps=30,setsar=1,format=yuv420p[v1]`)
  labels.push('[v1]')
  if (end < duration - 0.05) {
    filter.push(`[s2]trim=start=${end},setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v2]`)
    labels.push('[v2]')
  }
  if (labels.length > 1) filter.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[src]`)
  else filter.push('[v1]null[src]')
  filter.push('[src]fps=30,setsar=1,format=yuv420p[clean]')
} else {
  filter.push('[1:v]fps=30,setsar=1,format=yuv420p[clean]')
}

const cards = (frame.cards || []).slice().sort((a, b) => Number(a.start || 0) - Number(b.start || 0))
const layouts = frame.layouts || []
const segments = cards.map((card, index) => {
  const start = Math.max(0, Number(card.start || 0))
  const end = Math.min(duration, Number(card.end || duration))
  const layout = layouts[index] || video
  return { start, end, layout }
}).filter((segment) => segment.end - segment.start > 0.05)

if (segments.length) {
  filter.push(`[clean]split=${segments.length}${segments.map((_, index) => `[c${index}]`).join('')}`)
  segments.forEach((segment, index) => {
    const { layout, start, end } = segment
    filter.push(`[c${index}]trim=start=${start}:end=${end},setpts=PTS-STARTPTS+${start}/TB,scale=${layout.width}:${layout.height}:force_original_aspect_ratio=increase,crop=${layout.width}:${layout.height},pad=iw+16:ih+16:8:8:color=white,setsar=1,fps=30,format=yuv420p[v${index}]`)
  })
  let current = '[0:v]'
  segments.forEach((segment, index) => {
    const { layout, start, end } = segment
    const next = index === segments.length - 1 ? '[v]' : `[b${index}]`
    filter.push(`${current}[v${index}]overlay=${Number(layout.x || video.x) - 8}:${Number(layout.y || video.y) - 8}:enable='gte(t,${start})*lt(t,${end})'${next}`)
    current = next
  })
} else {
  filter.push(`[clean]scale=${video.width}:${video.height}:force_original_aspect_ratio=increase,crop=${video.width}:${video.height},pad=iw+16:ih+16:8:8:color=white,setsar=1[vid]`)
  filter.push(`[0:v][vid]overlay=${video.x - 8}:${video.y - 8}:shortest=1[v]`)
}
if (music && fs.existsSync(music)) {
  filter.push(
    `[1:a]asplit=2[voice][sc]`,
    `[2:a]volume=0.10,atrim=0:${duration},asetpts=PTS-STARTPTS[bgm]`,
    `[bgm][sc]sidechaincompress=threshold=0.02:ratio=6:attack=120:release=600[duck]`,
    `[voice][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
  )
} else {
  filter.push(`[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]`)
}
run([
  ...inputs,
  '-filter_complex', filter.join(';'),
  '-map', '[v]', '-map', '[a]',
  '-t', String(duration),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(arg('crf', '18')),
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart',
  out,
], '合成画中画')

const poster = path.join(path.dirname(out), 'poster.png')
run(['-ss', '1.2', '-i', out, '-frames:v', '1', poster], '导出封面')
const info = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate', '-of', 'json', out], { encoding: 'utf8' })
let meta = {}
try { meta = JSON.parse(info.stdout) } catch {}
const report = {
  ok: true,
  layer: rel(layer),
  source: rel(source),
  frame: rel(frameFile),
  output: rel(out),
  poster: rel(poster),
  duration: Number(meta.format?.duration || duration),
  bytes: Number(meta.format?.size || 0),
  width: Number(meta.streams?.find((s) => s.codec_name === 'h264')?.width || 0),
  height: Number(meta.streams?.find((s) => s.codec_name === 'h264')?.height || 0),
  video: video,
  music: music && fs.existsSync(music) ? music : null,
}
const reportFile = path.join(path.dirname(out), 'frame-report.json')
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ ...report, report: rel(reportFile) }, null, 2))
