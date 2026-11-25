#!/usr/bin/env node
/**
 * MiniMax voice clone + line synthesis for the current project.
 *
 *   node bin/voice.mjs --project projects/ai-for-ordinary-people
 *   node bin/voice.mjs --project projects/ai-for-ordinary-people --reclone
 *   node bin/voice.mjs --project projects/ai-for-ordinary-people --dry-run
 *
 * Env:
 *   MINIMAX_API_KEY=...
 *   MINIMAX_BASE_URL=https://api.minimax.cn/v1
 *   MINIMAX_TTS_MODEL=speech-2.8-hd
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readProfile, probeDuration } from '../src/voice-profile.mjs'
import { uploadFile, cloneVoice, synthesize, minimaxConfig } from '../src/minimax.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function has(name) {
  return process.argv.includes(`--${name}`)
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return fallback
  }
}

function rel(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, '/')
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function run(args, label) {
  const result = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${label}: ${(result.stderr || '').slice(-800)}`)
}

function buildPreview(files, outDir) {
  const inputs = []
  for (const file of files) inputs.push('-i', file)
  const filters = files.map((_, i) => `[${i}:a]apad=pad_dur=0.45[a${i}]`).join(';')
  const concatInputs = files.map((_, i) => `[a${i}]`).join('')
  const wav = path.join(outDir, 'voice-preview.wav')
  run([...inputs, '-filter_complex', `${filters};${concatInputs}concat=n=${files.length}:v=0:a=1[out]`, '-map', '[out]', '-ac', '1', '-ar', '24000', wav], 'voice preview')
  const mp3 = path.join(outDir, 'voice-preview.mp3')
  run(['-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3], 'voice preview mp3')
  return { wav, mp3 }
}

async function download(url, file) {
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) throw new Error(`试听音频下载失败：HTTP ${response.status}`)
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  return file
}

async function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/voice.mjs --project projects/<id> [--profile voices/me] [--reclone] [--voice-id ...] [--force] [--dry-run]')
  const projectDir = path.resolve(projectArg)
  const script = readJson(path.join(projectDir, 'script.json'))
  if (!script) throw new Error(`缺少 script.json：${projectDir}`)
  const profile = readProfile(arg('profile') || path.join('voices', script.voice || 'me'))
  const source = path.resolve(path.dirname(profile.profilePath), profile.source || 'me.m4a')
  if (!fs.existsSync(source)) throw new Error(`原始参考音频不存在：${source}`)
  const config = minimaxConfig()
  const model = arg('model') || profile.minimax?.model || config.model
  const languageBoost = arg('language-boost') || profile.minimax?.languageBoost || config.languageBoost
  const voiceId = arg('voice-id') || profile.minimax?.voiceId || process.env.MINIMAX_VOICE_ID || 'nutcut_me'
  const ttsKey = arg('tts-key') || process.env.MINIMAX_TTS_KEY || 'plan'
  const fileIdArg = arg('file-id')
  const outDir = path.resolve(arg('out', path.join('out', script.id)))
  const voDir = path.join(outDir, 'vo')
  const dryRun = has('dry-run')
  const force = has('force')
  const reclone = has('reclone')

  console.log(JSON.stringify({
    provider: 'minimax',
    baseUrl: config.baseUrl,
    hasKey: config.hasKey,
    hasPlanKey: config.hasPlanKey,
    model,
    languageBoost,
    ttsKey,
    voiceId,
    source: rel(source),
    lines: script.lines.length,
    out: rel(outDir),
  }, null, 2))

  if (dryRun) return

  let voiceProfile = profile.minimax || null
  if (!config.hasKey && (reclone || !voiceProfile)) {
    throw new Error('缺少 MINIMAX_API_KEY：克隆需要按量计费 Key，先把它写进 D:\\project\\NutCut\\.env，再运行')
  }

  if (voiceProfile && !reclone) {
    console.log(`[clone] reuse ${voiceProfile.voiceId}`)
  } else {
    let fileId = fileIdArg ? Number(fileIdArg) : null
    if (!fileId) {
      console.log(`[upload] ${rel(source)} → purpose=voice_clone`)
      const uploaded = await uploadFile(source, 'voice_clone')
      fileId = uploaded.fileId
      console.log(`[upload] file_id=${fileId}`)
    } else {
      console.log(`[upload] reuse file_id=${fileId}`)
    }
    const demoText = has('no-demo') ? '' : (arg('demo-text') || script.lines[0].text)
    const cloned = await cloneVoice({
      fileId,
      voiceId,
      text: demoText,
      model,
      languageBoost,
    })
    console.log(`[clone] voice_id=${cloned.voiceId}${cloned.demoAudio ? ' · demo ready' : ''}`)
    const rawProfile = readJson(profile.profilePath, {}) || {}
    rawProfile.provider = 'minimax'
    rawProfile.minimax = {
      voiceId: cloned.voiceId,
      fileId,
      model,
      languageBoost,
      source: rawProfile.source || path.basename(source),
      sourceSha256: sha256(source),
      ttsKey,
      createdAt: new Date().toISOString(),
      demoAudio: cloned.demoAudio,
      extraInfo: cloned.extraInfo,
    }
    fs.writeFileSync(profile.profilePath, JSON.stringify(rawProfile, null, 2) + '\n', 'utf8')
    voiceProfile = rawProfile.minimax
    if (cloned.demoAudio) {
      fs.mkdirSync(outDir, { recursive: true })
      try {
        await download(cloned.demoAudio, path.join(outDir, 'clone-demo.mp3'))
      } catch (error) {
        console.warn(`[clone] demo 下载失败，继续生成：${error.message}`)
      }
    }
  }

  const usedVoiceId = voiceProfile.voiceId
  if (has('test')) {
    const testText = arg('test-text') || '测试一下。'
    const result = await synthesize({
      text: testText,
      voiceId: usedVoiceId,
      model,
      languageBoost,
      format: 'wav',
      sampleRate: 24000,
      keyType: ttsKey,
    })
    fs.mkdirSync(outDir, { recursive: true })
    const file = path.join(outDir, 'test.wav')
    fs.writeFileSync(file, result.audio)
    console.log(JSON.stringify({
      ok: true,
      test: rel(file),
      duration: probeDuration(file),
      voiceId: usedVoiceId,
      keyType: ttsKey,
    }, null, 2))
    return
  }
  fs.mkdirSync(voDir, { recursive: true })
  const lines = []
  for (const line of script.lines) {
    const file = path.join(voDir, `${line.id}.wav`)
    let duration = fs.existsSync(file) ? probeDuration(file) : 0
    if (!fs.existsSync(file) || force) {
      const result = await synthesize({
        text: line.text,
        voiceId: usedVoiceId,
        model,
        languageBoost,
        format: 'wav',
        sampleRate: 24000,
        keyType: ttsKey,
      })
      fs.writeFileSync(file, result.audio)
      duration = probeDuration(file)
      console.log(`[tts] ${line.id} ${duration.toFixed(2)}s · ${line.text}`)
      lines.push({
        id: line.id,
        scene: line.scene,
        text: line.text,
        file: rel(file),
        duration,
        traceId: result.traceId,
        extraInfo: result.extraInfo,
      })
    } else {
      console.log(`[keep] ${line.id} ${duration.toFixed(2)}s · ${line.text}`)
      lines.push({
        id: line.id,
        scene: line.scene,
        text: line.text,
        file: rel(file),
        duration,
      })
    }
  }

  const preview = buildPreview(lines.map((line) => path.resolve(line.file)), outDir)
  const meta = {
    project: script.id,
    provider: 'minimax',
    voiceId: usedVoiceId,
    model,
    languageBoost,
    source: rel(source),
    createdAt: new Date().toISOString(),
    lines,
    preview: { wav: rel(preview.wav), mp3: rel(preview.mp3) },
  }
  fs.writeFileSync(path.join(voDir, 'vo.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8')
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    project: script.id,
    provider: 'minimax',
    voiceId: usedVoiceId,
    model,
    preview: rel(preview.mp3),
    lines: lines.length,
    total: Number(lines.reduce((sum, line) => sum + line.duration, 0).toFixed(2)),
  }, null, 2) + '\n', 'utf8')

  console.log(JSON.stringify({
    ok: true,
    provider: 'minimax',
    voiceId: usedVoiceId,
    preview: rel(preview.mp3),
    lines: lines.length,
    total: Number(lines.reduce((sum, line) => sum + line.duration, 0).toFixed(2)),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
