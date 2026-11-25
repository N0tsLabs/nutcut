#!/usr/bin/env node
/**
 * MiniMax ASR：把视频/音频转成带时间码的文字。
 *
 *   node bin/asr.mjs --file "D:/素材/口播.mp4" --out out/demo/asr.json
 *   node bin/asr.mjs --file talk.mp4 --out asr.json --language zh
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function loadEnv() {
  const env = {}
  const file = path.resolve('.env')
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match) env[match[1]] = match[2]
  }
  return env
}
function ensureDir(file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
}
function extractAudio(input, output) {
  const result = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', output], { encoding: 'utf8' })
  if (result.status !== 0 || !fs.existsSync(output)) throw new Error(`提取音频失败：${(result.stderr || '').slice(-500)}`)
}
function mergeLines(words) {
  const lines = []
  let current = null
  const flush = () => {
    if (!current) return
    const text = current.parts.join('').trim()
    if (text) lines.push({ start: Number(current.start.toFixed(3)), end: Number(current.end.toFixed(3)), text })
    current = null
  }
  for (const word of words) {
    const text = String(word.text || '')
    const start = Number(word.start || 0)
    const end = Number(word.end || start)
    if (!text.trim()) {
      flush()
      continue
    }
    if (!current) current = { start, end, parts: [] }
    if (current.parts.length && start - current.end > 0.8) flush()
    if (!current) current = { start, end, parts: [] }
    current.parts.push(text)
    current.end = end
    const plain = current.parts.join('')
    if (/[。！？!?]$/.test(text)) flush()
    else if (/[，,、；;：:]$/.test(text) && plain.length >= 9) flush()
    else if (plain.length >= 28) flush()
  }
  flush()
  return lines
}

const file = arg('file')
if (!file) throw new Error('用法：node bin/asr.mjs --file <video|audio> --out <json> [--language zh]')
if (!fs.existsSync(file)) throw new Error(`文件不存在：${file}`)
const out = arg('out', path.join('out', 'asr.json'))
const language = arg('language', 'zh')
const env = loadEnv()
const key = env.MINIMAX_PLAN_KEY || process.env.MINIMAX_PLAN_KEY || env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY
const base = (env.MINIMAX_BASE_URL || process.env.MINIMAX_BASE_URL || 'https://api.minimax.cn/v1').replace(/\/$/, '')
if (!key) throw new Error('缺少 MINIMAX_PLAN_KEY 或 MINIMAX_API_KEY')

const tmp = path.join(os.tmpdir(), `nutcut-asr-${Date.now()}.mp3`)
extractAudio(file, tmp)
try {
  const form = new FormData()
  form.append('model', 'asr-1.0')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_level', 'word')
  form.append('stream', 'false')
  form.append('file', new Blob([fs.readFileSync(tmp)], { type: 'audio/mpeg' }), 'audio.mp3')
  const response = await fetch(`${base}/speech_to_text`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, language },
    body: form,
  })
  const raw = await response.text()
  let data
  try { data = JSON.parse(raw) } catch { data = { raw } }
  if (!response.ok || data.base_resp?.status_code) {
    throw new Error(`ASR 失败：${response.status} ${raw.slice(0, 500)}`)
  }
  const words = (data.segments || []).map((segment) => ({
    start: Number(segment.start || 0),
    end: Number(segment.end || 0),
    speaker: segment.speaker || null,
    text: String(segment.text || ''),
  }))
  const result = {
    ok: true,
    source: path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/'),
    duration: Number(data.duration || 0),
    model: 'asr-1.0',
    language,
    traceId: data.trace_id || null,
    text: String(data.text || ''),
    lines: mergeLines(words),
    words,
  }
  ensureDir(out)
  fs.writeFileSync(path.resolve(out), JSON.stringify(result, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ ok: true, out: path.relative(process.cwd(), path.resolve(out)).replace(/\\/g, '/'), duration: result.duration, lines: result.lines.length, text: result.text }, null, 2))
} finally {
  fs.rmSync(tmp, { force: true })
}
