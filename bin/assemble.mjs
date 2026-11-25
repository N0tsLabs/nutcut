#!/usr/bin/env node
/**
 * 按 EDL 合成视频：切片段、推拉、调色、字幕、BGM、响度归一。
 *
 *   node bin/assemble.mjs --edl work/demo/edl.json --out out/demo/film.mp4
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { projectRenderBlock } from '../src/spec.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) { return process.argv.includes(`--${name}`) }
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function rel(file) { return path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/') }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }) }
function run(command, args, label, cwd) {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd })
  if (result.status !== 0) throw new Error(`${label}失败：${(result.stderr || '').slice(-1200)}`)
  return result
}
function ff(args, label, cwd) { return run('ffmpeg', ['-y', '-hide_banner', ...args], label, cwd) }
function assTime(seconds) {
  const value = Math.max(0, Number(seconds || 0))
  const h = Math.floor(value / 3600)
  const m = Math.floor((value % 3600) / 60)
  const s = Math.floor(value % 60)
  const cs = Math.round((value - Math.floor(value)) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(Math.min(99, cs)).padStart(2, '0')}`
}
function assEscape(text) {
  return String(text || '').replace(/\\/g, '／').replace(/\{/g, '（').replace(/\}/g, '）')
}
function wrapCaption(text, max = 15) {
  const value = assEscape(text)
  const chars = [...value]
  if (chars.length <= max) return value
  let split = Math.floor(chars.length / 2)
  try {
    const segments = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(value)]
    let acc = ''
    let best = null
    for (const item of segments) {
      acc += item.segment
      const length = [...acc].length
      if (length < 6 || length > chars.length - 4) continue
      const score = Math.abs(length - chars.length / 2)
      if (!best || score < best.score) best = { length, score }
    }
    if (best) split = best.length
  } catch {}
  return `${chars.slice(0, split).join('')}\\N${chars.slice(split).join('')}`
}
function buildAss(edl) {
  const { width, height } = edl.output
  const captionSize = Math.max(28, Math.round(width * 0.058))
  const titleSize = Math.max(36, Math.round(width * 0.078))
  const tagSize = Math.max(22, Math.round(width * 0.042))
  const marginV = Math.round(height * 0.085)
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,Microsoft YaHei,${captionSize},&H00FFFFFF,&H000000FF,&H00161616,&H80000000,-1,0,0,0,100,100,0,0,1,2.4,1.4,2,${Math.round(width * 0.06)},${Math.round(width * 0.06)},${marginV},1`,
    `Style: Title,Microsoft YaHei,${titleSize},&H00FFFFFF,&H000000FF,&H00161616,&H80000000,-1,0,0,0,100,100,1,0,1,3,2,8,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.07)},1`,
    `Style: Tag,Microsoft YaHei,${tagSize},&H00331A2B,&H000000FF,&H00F4E7FF,&H80000000,-1,0,0,0,100,100,1,0,3,10,0,9,${Math.round(width * 0.05)},${Math.round(width * 0.05)},${Math.round(height * 0.06)},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]
  for (const caption of edl.captions || []) {
    if (!caption.text) continue
    lines.push(`Dialogue: 0,${assTime(caption.start)},${assTime(caption.end)},Caption,,0,0,0,,{\\fad(80,80)}${wrapCaption(caption.text)}`)
  }
  for (const overlay of edl.overlays || []) {
    if (!overlay.text) continue
    const style = overlay.type === 'title' ? 'Title' : 'Tag'
    lines.push(`Dialogue: 1,${assTime(overlay.start)},${assTime(overlay.end)},${style},,0,0,0,,{\\fad(220,220)}${assEscape(overlay.text)}`)
  }
  return lines.join('\n') + '\n'
}
function filterPath(file) {
  return path.resolve(file).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}
function measureLoudness(file) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', 'NUL'], { encoding: 'utf8' })
  const match = /\{[\s\S]*\}/.exec(result.stderr || '')
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}
function normalizeAudio(input, output) {
  const measured = measureLoudness(input)
  if (!measured) {
    ff(['-i', input, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '2', '-ar', '48000', output], '响度归一')
    return
  }
  const filter = [
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
  ].join(':')
  ff(['-i', input, '-af', filter, '-ac', '2', '-ar', '48000', output], '响度归一')
}

const edlFile = arg('edl')
if (!edlFile) throw new Error('用法：node bin/assemble.mjs --edl <edl.json> --out <mp4> [--work <目录>] [--keep]')
const edl = readJson(edlFile)
if (!edl) throw new Error(`读不到 EDL：${edlFile}`)
const projectFile = path.join(path.dirname(path.resolve(edlFile)), 'project.json')
if (fs.existsSync(projectFile)) {
  const blocked = projectRenderBlock(readJson(projectFile))
  if (blocked) throw new Error(blocked)
}
const outFile = path.resolve(arg('out', path.join('out', path.basename(edlFile, '.json'), 'film.mp4')))
const workDir = path.resolve(arg('work', path.join(path.dirname(path.resolve(edlFile)), 'build')))
if (fs.existsSync(workDir) && !has('keep')) fs.rmSync(workDir, { recursive: true, force: true })
ensureDir(workDir)
ensureDir(path.dirname(outFile))
const source = path.resolve(edl.source)
if (!fs.existsSync(source)) throw new Error(`源视频不存在：${source}`)
const { width, height, fps, duration } = edl.output
const sourceAudio = edl.voice?.mode === 'source' && edl.voice?.sourceAudio !== false
const clipDir = path.join(workDir, 'clips')
ensureDir(clipDir)
const videoFiles = []
const audioFiles = []

for (let i = 0; i < edl.clips.length; i += 1) {
  const clip = edl.clips[i]
  const id = String(clip.id || `clip-${i + 1}`).padStart(8, '0')
  const videoFile = path.join(clipDir, `${id}.mp4`)
  const audioFile = path.join(clipDir, `${id}.wav`)
  const audioIn = Number(clip.audioIn ?? clip.sourceIn)
  const audioOut = Number(clip.audioOut ?? clip.sourceOut)
  const videoIn = Number(clip.videoIn ?? clip.sourceIn)
  const videoOut = Number(clip.videoOut ?? clip.sourceOut)
  const clipDuration = Number(clip.duration) || Math.max(0.1, audioOut - audioIn)
  const videoSpan = Math.max(0.1, Math.min(clipDuration, videoOut - videoIn || clipDuration))
  const padDuration = Math.max(0, clipDuration - videoSpan)
  const zoom = Math.max(1, Math.min(1.35, Number(clip.zoom || 1)))
  const pad = padDuration > 0.001 ? `tpad=stop_mode=clone:stop_duration=${padDuration.toFixed(3)}` : null
  const crop = clip.crop && clip.crop.width > 0 && clip.crop.height > 0
    ? `crop=trunc(${clip.crop.width}/2)*2:trunc(${clip.crop.height}/2)*2:${clip.crop.x || 0}:${clip.crop.y || 0}`
    : null
  const grade = 'eq=contrast=1.05:saturation=1.06:brightness=0.008,unsharp=5:5:0.45:5:5:0'
  if (clip.fit === 'blur') {
    const filter = [
      crop ? `[0:v]${crop},${pad ? `${pad},` : ''}split=2[bg][fg]` : `[0:v]${pad ? `${pad},` : ''}split=2[bg][fg]`,
      `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},boxblur=22:2,eq=brightness=-0.14:saturation=0.9[bg2]`,
      `[fg]scale=${width}:-2:flags=lanczos,${grade}[fg2]`,
      `[bg2][fg2]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${fps}[v]`,
    ].join(';')
    ff(['-ss', String(videoIn), '-t', String(videoSpan), '-i', source, '-an', '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), videoFile], `切片段 ${i + 1}`)
  } else {
    const zoomFilter = zoom > 1.001
      ? `crop=trunc(iw/${zoom}/2)*2:trunc(ih/${zoom}/2)*2:(iw-trunc(iw/${zoom}/2)*2)/2:(ih-trunc(ih/${zoom}/2)*2)/2,scale=${width}:${height}:flags=lanczos`
      : `scale=${width}:${height}:flags=lanczos`
    const videoFilter = [
      crop,
      pad,
      `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${width}:${height}`,
      grade,
      zoomFilter,
      'setsar=1',
      `fps=${fps}`,
    ].filter(Boolean).join(',')
    ff(['-ss', String(videoIn), '-t', String(videoSpan), '-i', source, '-an', '-vf', videoFilter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), videoFile], `切片段 ${i + 1}`)
  }
  videoFiles.push(videoFile)
  if (sourceAudio) {
    ff(['-ss', String(audioIn), '-t', String(clipDuration), '-i', source, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', audioFile], `提取原声 ${i + 1}`)
    audioFiles.push(audioFile)
  }
  console.error(`[assemble] ${i + 1}/${edl.clips.length}`)
}

const videoList = path.join(workDir, 'video-list.txt')
fs.writeFileSync(videoList, videoFiles.map((file) => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n', 'utf8')
const videoRaw = path.join(workDir, 'video-raw.mp4')
ff(['-f', 'concat', '-safe', '0', '-i', videoList, '-c', 'copy', '-fflags', '+genpts', videoRaw], '拼接画面')

let voiceRaw = null
if (sourceAudio) {
  const audioList = path.join(workDir, 'audio-list.txt')
  fs.writeFileSync(audioList, audioFiles.map((file) => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n', 'utf8')
  voiceRaw = path.join(workDir, 'voice-raw.wav')
  ff(['-f', 'concat', '-safe', '0', '-i', audioList, '-c', 'copy', voiceRaw], '拼接原声')
} else if (edl.voice?.track && fs.existsSync(edl.voice.track)) {
  voiceRaw = path.resolve(edl.voice.track)
} else if (edl.voice?.mode === 'clone') {
  throw new Error('EDL 要求克隆配音，但没有提供 edl.voice.track。先生成 TTS 再合成。')
}

let mixed = path.join(workDir, 'audio-mix.wav')
if (voiceRaw && edl.music?.file && fs.existsSync(edl.music.file)) {
  const musicVolume = Number(edl.music.volume ?? 0.12)
  const duck = edl.music.ducking || {}
  const threshold = Number(duck.threshold ?? 0.02)
  const ratio = Number(duck.ratio ?? 6)
  const attack = Number(duck.attack ?? 120)
  const release = Number(duck.release ?? 600)
  const filter = [
    `[1:a]volume=${musicVolume},atrim=0:${duration},asetpts=PTS-STARTPTS[bgm]`,
    `[0:a]asplit=2[voice][sc]`,
    `[bgm][sc]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[duck]`,
    `[voice][duck]amix=inputs=2:duration=first:normalize=0[a]`,
  ].join(';')
  ff(['-i', voiceRaw, '-stream_loop', '-1', '-i', path.resolve(edl.music.file), '-filter_complex', filter, '-map', '[a]', '-ac', '2', '-ar', '48000', mixed], '人声与 BGM 混音')
} else if (voiceRaw) {
  ff(['-i', voiceRaw, '-ac', '2', '-ar', '48000', mixed], '原声整理')
} else if (edl.music?.file && fs.existsSync(edl.music.file)) {
  ff(['-stream_loop', '-1', '-i', path.resolve(edl.music.file), '-t', String(duration), '-af', `volume=${Number(edl.music.volume ?? 0.12)}`, '-ac', '2', '-ar', '48000', mixed], 'BGM')
} else {
  ff(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${duration}`, '-t', String(duration), '-ac', '2', '-ar', '48000', mixed], '生成静音')
}

const audioFinal = path.join(workDir, 'audio-final.wav')
normalizeAudio(mixed, audioFinal)

const assFile = path.join(workDir, 'captions.ass')
fs.writeFileSync(assFile, buildAss(edl), 'utf8')
const subtitleFilter = `subtitles='${filterPath(assFile)}':fontsdir='C\\:/Windows/Fonts'`
const finalFilter = `[0:v]${subtitleFilter}[v]`
ff([
  '-i', videoRaw,
  '-i', audioFinal,
  '-filter_complex', finalFilter,
  '-map', '[v]',
  '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(arg('crf', '18')),
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart',
  outFile,
], '合成成片')

const poster = path.join(path.dirname(outFile), 'poster.png')
ff(['-ss', String(Math.min(1.2, duration / 3)), '-i', outFile, '-frames:v', '1', poster], '导出封面')

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate', '-of', 'json', outFile], { encoding: 'utf8' })
let info = {}
try { info = JSON.parse(probe.stdout) } catch {}
const report = {
  ok: true,
  source: rel(source),
  edl: rel(edlFile),
  output: rel(outFile),
  poster: rel(poster),
  voice: edl.voice,
  duration: Number(info.format?.duration || duration),
  bytes: Number(info.format?.size || 0),
  width,
  height,
  fps,
  clips: edl.clips.length,
  captions: edl.captions?.length || 0,
  music: edl.music?.file || null,
}
const reportFile = path.join(path.dirname(outFile), 'remix-report.json')
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8')
if (!has('keep')) fs.rmSync(workDir, { recursive: true, force: true })
console.log(JSON.stringify({ ...report, report: rel(reportFile) }, null, 2))
