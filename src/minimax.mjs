import fs from 'node:fs'
import path from 'node:path'
import { loadEnv } from './env.mjs'

loadEnv()

const BASE_URL = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.cn/v1').replace(/\/+$/, '')

function key(which = 'api') {
  const name = which === 'plan' ? 'MINIMAX_PLAN_KEY' : 'MINIMAX_API_KEY'
  const value = process.env[name]
  if (!value) {
    if (which === 'plan') throw new Error('缺少 MINIMAX_PLAN_KEY：把它写进 D:\\project\\NutCut\\.env，然后重新运行')
    throw new Error('缺少 MINIMAX_API_KEY：把它写进 D:\\project\\NutCut\\.env，然后重新运行')
  }
  return value
}

function mime(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.m4a') return 'audio/mp4'
  if (ext === '.wav') return 'audio/wav'
  throw new Error('MiniMax 只接受 mp3 / m4a / wav')
}

function check(data, label) {
  const code = data?.base_resp?.status_code
  if (code !== undefined && code !== 0) {
    const message = data.base_resp?.status_msg || 'unknown error'
    let hint = ''
    if (code === 2061) hint = ' 当前套餐不支持该模型/功能；需要升级套餐，或改用按量计费 Key。'
    if (code === 2038) hint = ' 账号未完成声音复刻认证，请先在 MiniMax 控制台完成认证。'
    if (code === 1008) hint = ' 账户余额不足，请先充值后再试。'
    throw new Error(`${label} 失败：${code} ${message}.${hint}`)
  }
  return data
}

async function jsonRequest(url, body, which = 'api') {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key(which)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`MiniMax 返回非 JSON（HTTP ${response.status}）：${text.slice(0, 600)}`)
  }
  if (!response.ok) throw new Error(`MiniMax HTTP ${response.status}：${text.slice(0, 600)}`)
  return data
}

/** Upload a local audio file and return its MiniMax file_id. */
export async function uploadFile(file, purpose = 'voice_clone') {
  const target = path.resolve(file)
  if (!fs.existsSync(target)) throw new Error(`文件不存在：${target}`)
  const bytes = fs.readFileSync(target)
  if (bytes.length > 20 * 1024 * 1024) throw new Error('MiniMax 上传文件不能超过 20MB')
  const form = new FormData()
  form.append('purpose', purpose)
  form.append('file', new Blob([bytes], { type: mime(target) }), path.basename(target))
  const response = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key('api')}` },
    body: form,
  })
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`MiniMax 上传返回非 JSON（HTTP ${response.status}）：${text.slice(0, 600)}`)
  }
  if (!response.ok) throw new Error(`MiniMax 上传 HTTP ${response.status}：${text.slice(0, 600)}`)
  check(data, '上传参考音频')
  const fileId = data?.file?.file_id
  if (!fileId) throw new Error(`上传没有返回 file_id：${JSON.stringify(data).slice(0, 600)}`)
  return { fileId, raw: data }
}

/**
 * Create a persistent MiniMax voice_id from an uploaded file.
 * Include `text` to also receive a demo audio URL.
 */
export async function cloneVoice({ fileId, voiceId, text = '', model = 'speech-2.8-hd', languageBoost = 'Chinese', clonePrompt = null }) {
  const body = {
    file_id: fileId,
    voice_id: voiceId,
    language_boost: languageBoost,
    need_noise_reduction: false,
    need_volume_normalization: false,
  }
  if (text) {
    body.text = text
    body.model = model
  }
  if (clonePrompt) body.clone_prompt = clonePrompt
  const data = await jsonRequest(`${BASE_URL}/voice_clone`, body)
  check(data, '音色克隆')
  return {
    voiceId,
    demoAudio: data.demo_audio || null,
    extraInfo: data.extra_info || null,
    raw: data,
  }
}

/** Synthesize one line with a cloned voice_id. Returns a Buffer. */
export async function synthesize({ text, voiceId, model = 'speech-2.8-turbo', languageBoost = 'Chinese', format = 'wav', sampleRate = 24000, emotion = '', speed = 1, vol = 1, pitch = 0, keyType = 'plan' }) {
  if (!text) throw new Error('缺少合成文本')
  if (!voiceId) throw new Error('缺少 voice_id')
  const which = keyType === 'plan' ? 'plan' : keyType === 'api' ? 'api' : (process.env.MINIMAX_PLAN_KEY ? 'plan' : 'api')
  const voiceSetting = { voice_id: voiceId, speed, vol, pitch }
  if (emotion) voiceSetting.emotion = emotion
  const audioSetting = {
    sample_rate: sampleRate,
    format,
    channel: 1,
  }
  if (format === 'mp3') audioSetting.bitrate = 128000
  const body = {
    model,
    text,
    stream: false,
    output_format: 'hex',
    voice_setting: voiceSetting,
    audio_setting: audioSetting,
    language_boost: languageBoost,
  }
  const data = await jsonRequest(`${BASE_URL}/t2a_v2`, body, which)
  check(data, '语音合成')
  const hex = data?.data?.audio
  if (!hex) throw new Error(`合成没有返回音频：${JSON.stringify(data).slice(0, 800)}`)
  return {
    audio: Buffer.from(hex, 'hex'),
    traceId: data.trace_id || null,
    extraInfo: data.extra_info || null,
    raw: data,
  }
}

export function minimaxConfig() {
  return {
    baseUrl: BASE_URL,
    hasKey: Boolean(process.env.MINIMAX_API_KEY),
    hasPlanKey: Boolean(process.env.MINIMAX_PLAN_KEY),
    model: process.env.MINIMAX_TTS_MODEL || 'speech-2.8-turbo',
    languageBoost: process.env.MINIMAX_LANGUAGE_BOOST || 'Chinese',
  }
}

/** Generate images with MiniMax-H3-Image. Defaults to the M Plan key; no balance fallback. */
export async function generateImage({ prompt, model = 'MiniMax-H3-Image', size = '2720x1536', n = 1, outputFormat = 'png', keyType = 'plan' }) {
  if (!prompt) throw new Error('缺少图片 prompt')
  const which = keyType === 'plan' ? 'plan' : 'api'
  if (which === 'plan' && !process.env.MINIMAX_PLAN_KEY) {
    throw new Error('缺少 MINIMAX_PLAN_KEY：图片生成默认只走 Go 套餐，不会回退到余额')
  }
  const body = {
    model,
    prompt,
    size,
    n,
    output_format: outputFormat,
    response_format: 'url',
  }
  const data = await jsonRequest(`${BASE_URL}/images/generations`, body, which)
  const items = (data.data || []).map((item, index) => ({
    index,
    url: item.url || null,
    b64: item.b64_json || null,
    size: item.size || null,
    revisedPrompt: item.revised_prompt || null,
    error: item.error || null,
  }))
  const failed = items.filter((item) => item.error)
  if (!items.length || failed.length === items.length) {
    const detail = failed.map((item) => `${item.error.code}: ${item.error.message}`).join('; ')
    throw new Error(`图片生成失败：${detail || JSON.stringify(data).slice(0, 600)}`)
  }
  return {
    items,
    failed,
    outputFormat: data.output_format || outputFormat,
    usage: data.usage || null,
    requestId: data.request_id || null,
    raw: data,
  }
}
