#!/usr/bin/env node
/**
 * 根据分析结果生成剪辑决策表（EDL）。默认针对口播素材：
 * 保留原声、按句切镜头、去长静音、加字幕、轻微推拉、卖点标签、BGM。
 *
 *   node bin/remix-plan.mjs --analysis out/demo/analysis/analysis.json --out out/demo/edl.json
 *   node bin/remix-plan.mjs --analysis ... --out ... --title "冬天护手计划" --voice auto
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function args(name) {
  const out = []
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1])
  }
  return out
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function rel(file) { return path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/') }
function clean(text) { return String(text || '').replace(/[，,。！？!?；;：:]+$/g, '').trim() }

function buildKeepRanges(duration, silences) {
  const ranges = []
  let cursor = 0
  for (const silence of [...silences].sort((a, b) => a.start - b.start)) {
    if (silence.duration < 0.35) continue
    const cutStart = Math.max(cursor, silence.start + 0.12)
    const cutEnd = Math.min(duration, silence.end - 0.12)
    if (cutEnd <= cutStart) continue
    if (cutStart > cursor) ranges.push({ start: cursor, end: cutStart })
    cursor = cutEnd
  }
  if (cursor < duration) ranges.push({ start: cursor, end: duration })
  return ranges.filter((range) => range.end - range.start > 0.05)
}

function chooseMusic(transcript) {
  const text = String(transcript || '')
  if (/护手|护肤|美妆|香水|口红/.test(text)) return 'library/music/openlofi/soft-gold-sky.mp3'
  if (/咖啡|下午|生活|日常|治愈/.test(text)) return 'library/music/openlofi/breezy-afternoon-terrace.mp3'
  return 'library/music/openlofi/soft-weightless-hours.mp3'
}

function keywordTags(lines, lineTimes) {
  const rules = [
    { pattern: /香味|好闻/, text: '自然香味' },
    { pattern: /吸收/, text: '吸收快' },
    { pattern: /粘腻|清爽/, text: '不粘腻' },
    { pattern: /优惠|购买|囤/, text: '现在有优惠' },
    { pattern: /冬天|秋冬/, text: '冬季护手' },
  ]
  const tags = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const times = lineTimes.get(i + 1)
    if (!times) continue
    for (const rule of rules) {
      if (!rule.pattern.test(line.text)) continue
      const start = times.start
      const end = times.end
      if (end - start < 0.6) continue
      tags.push({ type: 'tag', start: Number(start.toFixed(3)), end: Number((start + Math.min(2.4, end - start)).toFixed(3)), text: rule.text })
    }
  }
  const seen = new Set()
  return tags.filter((tag) => {
    if (seen.has(tag.text)) return false
    seen.add(tag.text)
    return true
  }).slice(0, 5)
}

const analysisFile = arg('analysis')
if (!analysisFile) throw new Error('用法：node bin/remix-plan.mjs --analysis <analysis.json> --out <edl.json> [--title 标题] [--voice auto|source|clone|none]')
const analysis = readJson(analysisFile)
if (!analysis) throw new Error(`读不到分析文件：${analysisFile}`)
const outFile = arg('out', path.join(path.dirname(analysisFile), 'edl.json'))
const width = Number(arg('width', '720'))
const height = Number(arg('height', '1280'))
const fps = Number(arg('fps', '30'))
const style = arg('style', 'talking-head')
const voiceArg = arg('voice', 'auto')
const voiceMode = voiceArg === 'auto' ? analysis.voice?.mode || 'source' : voiceArg
if (!['source', 'clone', 'none'].includes(voiceMode)) throw new Error(`不支持的 voice：${voiceMode}`)

const lines = (analysis.transcript?.lines || []).filter((line) => clean(line.text))
if (!lines.length) throw new Error('没有可用的转写句子，无法生成口播剪辑')
const targetAspect = width / height
const duration = Number(analysis.duration || lines[lines.length - 1].end + 0.2)
const ranges = buildKeepRanges(duration, analysis.silences || [])
const shots = analysis.shots || []
const shotAt = (time) => shots.find((shot) => time >= shot.start && time < shot.end) || shots[shots.length - 1] || null
const brollRules = readJson(arg('broll', ''), [])
const findBroll = (text) => (Array.isArray(brollRules) ? brollRules : []).find((rule) => {
  if (!rule || rule.from == null) return false
  try { return new RegExp(rule.match || '').test(text) } catch { return String(text).includes(String(rule.match || '')) }
})
const zooms = [1.03, 1.0, 1.06, 1.01, 1.08, 1.0, 1.04, 1.02]
const clips = []

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i]
  const prev = lines[i - 1]
  const next = lines[i + 1]
  let sourceStart = Math.max(0, line.start - 0.05)
  let sourceEnd = Math.min(duration, line.end + 0.08)
  if (prev) sourceStart = Math.max(sourceStart, prev.end + 0.02)
  if (next) sourceEnd = Math.min(sourceEnd, next.start - 0.02)
  if (sourceEnd - sourceStart < 0.12) continue
  const broll = findBroll(line.text)
  if (broll) {
    for (const range of ranges) {
      const start = Math.max(sourceStart, range.start)
      const end = Math.min(sourceEnd, range.end)
      if (end - start < 0.12) continue
      const clipDuration = end - start
      const videoIn = Math.max(0, Math.min(duration - 0.1, Number(broll.from)))
      let videoOut = broll.to != null ? Math.max(videoIn + 0.1, Number(broll.to)) : videoIn + clipDuration
      videoOut = Math.min(duration, videoOut)
      const shot = shotAt(videoIn)
      const needsPad = Boolean(broll.pad) || videoOut - videoIn < clipDuration - 0.02
      clips.push({
        id: `clip-${String(clips.length + 1).padStart(3, '0')}`,
        lineId: i + 1,
        shot: shot?.index || null,
        sourceIn: Number(start.toFixed(3)),
        sourceOut: Number(end.toFixed(3)),
        audioIn: Number(start.toFixed(3)),
        audioOut: Number(end.toFixed(3)),
        videoIn: Number(videoIn.toFixed(3)),
        videoOut: Number(videoOut.toFixed(3)),
        videoPad: needsPad,
        broll: true,
        timelineStart: 0,
        duration: Number(clipDuration.toFixed(3)),
        zoom: 1.02,
        fit: shot?.content && (shot.content.width / shot.content.height) > targetAspect * 1.15 ? 'blur' : 'crop',
        crop: shot?.content ? { width: shot.content.width, height: shot.content.height, x: shot.content.x, y: shot.content.y } : null,
        caption: clean(line.text),
      })
    }
    continue
  }
  for (const range of ranges) {
    const start = Math.max(sourceStart, range.start)
    const end = Math.min(sourceEnd, range.end)
    if (end - start < 0.12) continue
    const cutPoints = [start, ...shots.map((shot) => shot.start).filter((time) => time > start + 0.02 && time < end - 0.02), end]
    for (let part = 0; part < cutPoints.length - 1; part += 1) {
      const partStart = cutPoints[part]
      const partEnd = cutPoints[part + 1]
      if (partEnd - partStart < 0.12) continue
      const shot = shotAt((partStart + partEnd) / 2)
      clips.push({
        id: `clip-${String(clips.length + 1).padStart(3, '0')}`,
        lineId: i + 1,
        shot: shot?.index || null,
        sourceIn: Number(partStart.toFixed(3)),
        sourceOut: Number(partEnd.toFixed(3)),
        audioIn: Number(partStart.toFixed(3)),
        audioOut: Number(partEnd.toFixed(3)),
        videoIn: Number(partStart.toFixed(3)),
        videoOut: Number(partEnd.toFixed(3)),
        videoPad: false,
        broll: false,
        timelineStart: 0,
        duration: Number((partEnd - partStart).toFixed(3)),
        zoom: style === 'clean' ? 1 : zooms[i % zooms.length],
        fit: shot?.content && (shot.content.width / shot.content.height) > targetAspect * 1.15 ? 'blur' : 'crop',
        crop: shot?.content ? { width: shot.content.width, height: shot.content.height, x: shot.content.x, y: shot.content.y } : null,
        caption: clean(line.text),
      })
    }
  }
}

let cursor = 0
for (const clip of clips) {
  clip.timelineStart = Number(cursor.toFixed(3))
  cursor += clip.duration
}
const totalDuration = Number(cursor.toFixed(3))
const lineTimes = new Map()
for (const clip of clips) {
  const times = lineTimes.get(clip.lineId) || { start: clip.timelineStart, end: clip.timelineStart }
  times.end = Number((clip.timelineStart + clip.duration).toFixed(3))
  lineTimes.set(clip.lineId, times)
}
const captions = lines.map((line, index) => {
  const times = lineTimes.get(index + 1)
  return times ? { start: times.start, end: times.end, text: clean(line.text) } : null
}).filter(Boolean)

const title = arg('title', /护手|护肤|美妆/.test(analysis.transcript?.text || '') ? '冬天护手计划' : '')
const overlays = []
if (title) overlays.push({ type: 'title', start: 0.35, end: Math.min(2.6, totalDuration), text: title })
for (const [index, tag] of keywordTags(lines, lineTimes).entries()) {
  overlays.push({ ...tag, text: `${String(index + 1).padStart(2, '0')}  ${tag.text}` })
}
for (const extra of args('tag')) {
  const [start, end, text] = extra.split('|')
  if (!text) continue
  overlays.push({ type: 'tag', start: Number(start || 0), end: Number(end || Number(start || 0) + 2), text })
}

const musicFile = arg('music', chooseMusic(analysis.transcript?.text || ''))
const edl = {
  version: 1,
  createdAt: new Date().toISOString(),
  source: analysis.source,
  analysis: rel(analysisFile),
  style,
  output: {
    width,
    height,
    fps,
    duration: Number(totalDuration.toFixed(3)),
  },
  voice: {
    mode: voiceMode,
    hasSpeech: Boolean(analysis.voice?.hasSpeech),
    reason: analysis.voice?.reason || '',
    sourceAudio: voiceMode === 'source',
  },
  music: musicFile && fs.existsSync(musicFile) ? {
    file: musicFile,
    volume: 0.12,
    ducking: { threshold: 0.02, ratio: 6, attack: 120, release: 600 },
  } : null,
  captions,
  overlays,
  clips,
}
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true })
fs.writeFileSync(path.resolve(outFile), JSON.stringify(edl, null, 2) + '\n', 'utf8')

console.log(JSON.stringify({
  ok: true,
  edl: rel(outFile),
  duration: edl.output.duration,
  clips: clips.length,
  captions: captions.length,
  overlays: overlays.length,
  voice: edl.voice,
  music: edl.music?.file || null,
}, null, 2))
