#!/usr/bin/env node
/**
 * 视频分析：探针、镜头切分、关键帧、静音段、语音转写、配音决策。
 *
 *   node bin/analyze-video.mjs --file "D:/素材/口播.mp4" --out out/demo/analysis
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }) }
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function rel(file) { return path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/') }
function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${label}失败：${(result.stderr || '').slice(-600)}`)
  return result
}
function probe(file) {
  const result = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', file], 'ffprobe')
  return JSON.parse(result.stdout)
}
function detectScenes(file, outDir, threshold) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', `select='gt(scene,${threshold})',metadata=print:file=-`, '-an', '-f', 'null', 'NUL'], { encoding: 'utf8' })
  const times = []
  for (const line of `${result.stdout || ''}\n${result.stderr || ''}`.split(/\r?\n/)) {
    const match = /pts_time:([0-9.]+)/.exec(line)
    if (match) times.push(Number(match[1]))
  }
  return [...new Set(times.map((t) => Number(t.toFixed(3))))].sort((a, b) => a - b)
}
function detectSilences(file) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'silencedetect=noise=-20dB:d=0.3', '-f', 'null', 'NUL'], { encoding: 'utf8' })
  const silences = []
  let start = null
  for (const line of (result.stderr || '').split(/\r?\n/)) {
    const s = /silence_start:\s*([0-9.]+)/.exec(line)
    const e = /silence_end:\s*([0-9.]+)/.exec(line)
    if (s) start = Number(s[1])
    if (e && start != null) {
      const end = Number(e[1])
      if (end > start) silences.push({ start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), duration: Number((end - start).toFixed(3)) })
      start = null
    }
  }
  return silences
}
function buildShots(cuts, duration) {
  const points = [0, ...cuts.filter((t) => t > 0.3 && t < duration - 0.2), duration]
  const shots = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    if (end - start < 0.25) continue
    shots.push({ index: shots.length + 1, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), duration: Number((end - start).toFixed(3)), keyframe: null })
  }
  return shots
}
function extractKeyframes(file, shots, outDir) {
  const dir = path.join(outDir, 'keyframes')
  ensureDir(dir)
  for (const shot of shots) {
    const time = Number(((shot.start + shot.end) / 2).toFixed(3))
    const name = `shot-${String(shot.index).padStart(3, '0')}.jpg`
    const out = path.join(dir, name)
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1', '-vf', 'scale=480:-1', '-q:v', '4', out], { encoding: 'utf8' })
    if (fs.existsSync(out)) shot.keyframe = rel(out)
  }
  return dir
}
function detectShotContent(file, shot, video) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(shot.start), '-t', String(Math.min(1.5, shot.duration)), '-i', file, '-vf', 'cropdetect=24:2:0', '-f', 'null', 'NUL'], { encoding: 'utf8' })
  const matches = [...(result.stderr || '').matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)]
  if (!matches.length) return null
  const match = matches[matches.length - 1]
  let width = Number(match[1])
  let height = Number(match[2])
  const x = Number(match[3])
  const y = Number(match[4])
  if (width < 32 || height < 32) return null
  width = Math.min(width, Number(video.width || width))
  height = Math.min(height, Number(video.height || height))
  const aspect = Number((width / height).toFixed(3))
  return { width, height, x, y, aspect, fit: aspect > 0.75 ? 'blur' : 'crop' }
}

const file = arg('file')
if (!file) throw new Error('用法：node bin/analyze-video.mjs --file <video> --out <分析目录> [--language zh] [--threshold 0.28]')
if (!fs.existsSync(file)) throw new Error(`文件不存在：${file}`)
const outDir = path.resolve(arg('out', path.join('out', 'analysis')))
ensureDir(outDir)
const language = arg('language', 'zh')
const threshold = Number(arg('threshold', '0.28'))

const info = probe(file)
const video = info.streams?.find((stream) => stream.codec_type === 'video') || {}
const audio = info.streams?.find((stream) => stream.codec_type === 'audio') || {}
const duration = Number(info.format?.duration || 0)
const cuts = detectScenes(file, outDir, threshold)
const shots = buildShots(cuts, duration)
for (const shot of shots) {
  shot.content = detectShotContent(file, shot, video) || {
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    x: 0,
    y: 0,
    aspect: Number(((Number(video.width || 1)) / Number(video.height || 1)).toFixed(3)),
    fit: 'crop',
  }
}
extractKeyframes(file, shots, outDir)
const silences = detectSilences(file)

const asrOut = path.join(outDir, 'asr.json')
let asr = null
const asrResult = spawnSync('node', ['bin/asr.mjs', '--file', file, '--out', asrOut, '--language', language], { encoding: 'utf8' })
if (asrResult.status === 0 && fs.existsSync(asrOut)) asr = readJson(asrOut, null)
else console.error(`[analyze] ASR 未完成：${(asrResult.stderr || '').slice(-400)}`)

const transcript = asr?.text || ''
const chineseChars = [...transcript].filter((ch) => /[\u3400-\u9fff]/.test(ch)).length
const speechSeconds = (asr?.lines || []).reduce((sum, line) => sum + Math.max(0, Number(line.end) - Number(line.start)), 0)
const coverage = duration > 0 ? speechSeconds / duration : 0
const hasSpeech = chineseChars >= 8 && speechSeconds >= 2
const cloneAvailable = fs.existsSync(path.join('voices', 'me', 'profile.json'))
const voiceMode = hasSpeech ? 'source' : cloneAvailable ? 'clone' : 'none'
const voice = {
  mode: voiceMode,
  hasSpeech,
  speechChars: chineseChars,
  speechSeconds: Number(speechSeconds.toFixed(3)),
  coverage: Number(coverage.toFixed(3)),
  cloneAvailable,
  reason: hasSpeech
    ? `素材检测到 ${chineseChars} 字、约 ${speechSeconds.toFixed(1)} 秒连续人声，保留原声，不重新配音。`
    : cloneAvailable
      ? '素材没有足够人声，建议使用已克隆的 me 声音配音。'
      : '素材没有足够人声，也没有可用声音档案。',
}
const vertical = Number(video.width || 0) < Number(video.height || 0)
const styleOptions = [
  {
    id: 'overlay',
    label: '原片增强',
    description: '视频保持全屏，只加字幕、包装、音效；需要时可加配音。',
    bestFor: '口播、访谈、已经有完整剪辑的素材',
  },
  {
    id: 'frame-motion',
    label: '模板画中画',
    description: '视频作为模板里的一个元素，位置/大小随章节变化，页面持续动效。',
    bestFor: '竖屏口播、产品讲解、知识分享',
  },
  {
    id: 'remix-edl',
    label: '混剪 / 解说',
    description: '按镜头重剪，插入 B-roll 或电影片段，生成解说 EDL。',
    bestFor: '电影解说、多素材混剪、长视频',
  },
]
const recommendedStyle = vertical && hasSpeech ? 'frame-motion' : hasSpeech ? 'overlay' : 'remix-edl'

const analysis = {
  version: 1,
  createdAt: new Date().toISOString(),
  source: rel(file),
  duration,
  probe: {
    format: info.format || {},
    video: {
      codec: video.codec_name,
      width: video.width,
      height: video.height,
      fps: video.r_frame_rate,
    },
    audio: audio ? { codec: audio.codec_name, sampleRate: audio.sample_rate, channels: audio.channels } : null,
  },
  shots,
  silences,
  transcript: asr ? {
    path: rel(asrOut),
    text: transcript,
    lines: asr.lines || [],
    words: asr.words || [],
    traceId: asr.traceId || null,
  } : { path: null, text: '', lines: [], words: [] },
  voice,
  style: {
    needsUserChoice: true,
    recommended: recommendedStyle,
    orientation: vertical ? 'vertical' : 'horizontal',
    options: styleOptions,
  },
}
const out = path.join(outDir, 'analysis.json')
fs.writeFileSync(out, JSON.stringify(analysis, null, 2) + '\n', 'utf8')

console.log(JSON.stringify({
  ok: true,
  analysis: rel(out),
  duration,
  resolution: `${video.width}x${video.height}`,
  shots: shots.length,
  cuts,
  silences: silences.length,
  keyframes: shots.filter((shot) => shot.keyframe).length,
  transcriptChars: chineseChars,
  voice,
  style: analysis.style,
}, null, 2))
