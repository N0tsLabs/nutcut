#!/usr/bin/env node
/**
 * Build music + SFX + voiceover mix.
 *
 * If out/<id>/bgm.mp3 (or .wav/.m4a) exists, use it as BGM and duck under voice.
 * Otherwise fall back to the synthesized ambient bed.
 *
 *   node bin/audio-mix.mjs --project projects/ai-for-ordinary-people
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return fallback
  }
}

function run(args, label) {
  const result = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${label}: ${(result.stderr || '').slice(-900)}`)
}

function probe(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  return Number((result.stdout || '0').trim())
}

function buildMusic(file, duration) {
  const expr = '0.035*(sin(2*PI*110*t)+0.7*sin(2*PI*164.81*t)+0.45*sin(2*PI*220*t))*(0.6+0.4*sin(2*PI*0.06*t))'
  const fadeOut = Math.max(0, duration - 3)
  const filters = [
    '[1:a]volume=0.035,lowpass=f=120[sub]',
    '[2:a]volume=0.004,lowpass=f=2400[air]',
    `[0:a][sub][air]amix=inputs=3:duration=first:normalize=0,lowpass=f=1800,aecho=0.8:0.7:120|240:0.18|0.1,atrim=0:${duration},afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOut}:d=3,volume=0.9[out]`,
  ].join(';')
  run([
    '-f', 'lavfi', '-i', `aevalsrc=${expr}:s=48000:d=${duration}`,
    '-f', 'lavfi', '-i', `sine=frequency=55:duration=${duration}`,
    '-f', 'lavfi', '-i', `anoisesrc=color=pink:duration=${duration}`,
    '-filter_complex', filters,
    '-map', '[out]', '-ac', '1', '-ar', '48000', file,
  ], 'music')
}

function buildBgm(source, file, duration) {
  const fadeOut = Math.max(0, duration - 3)
  run([
    '-stream_loop', '-1',
    '-i', source,
    '-t', String(duration),
    '-vn',
    '-af', `volume=0.55,afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOut}:d=3`,
    '-ac', '2', '-ar', '48000', file,
  ], 'bgm')
}

function findSfx(outDir, category) {
  for (const ext of ['.ogg', '.wav', '.mp3', '.m4a']) {
    const file = path.join(outDir, 'sfx', `${category}${ext}`)
    if (fs.existsSync(file)) return file
  }
  return null
}

function buildSfx(dir, outDir) {
  const custom = {
    transition: findSfx(outDir, 'transition'),
    impact: findSfx(outDir, 'impact'),
    tick: findSfx(outDir, 'tick'),
  }
  let whoosh = custom.transition
  if (!whoosh) {
    whoosh = path.join(dir, 'whoosh.wav')
    run(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=0.85', '-af', 'highpass=f=320,lowpass=f=4200,afade=t=in:st=0:d=0.06,afade=t=out:st=0.28:d=0.5,volume=0.26', whoosh], 'whoosh')
  }
  let impact = custom.impact
  if (!impact) {
    impact = path.join(dir, 'impact.wav')
    run(['-f', 'lavfi', '-i', 'sine=frequency=52:duration=1.0', '-af', 'afade=t=out:st=0.03:d=0.9,volume=0.5', impact], 'impact')
  }
  let tick = custom.tick
  if (!tick) {
    tick = path.join(dir, 'tick.wav')
    run(['-f', 'lavfi', '-i', 'sine=frequency=1600:duration=0.04', '-af', 'afade=t=out:st=0:d=0.04,volume=0.16', tick], 'tick')
  }
  return { whoosh, impact, tick, custom }
}

function buildMix(musicFile, sfx, timing, vo, dest, isBgm = false, ducking = {}, edit = {}) {
  const duration = timing.duration
  const musicVolume = edit.music?.muted ? 0 : (isBgm ? 0.55 : 0.16) * Number(edit.music?.volume ?? 1)
  const voiceVolume = edit.voice?.muted ? 0 : Number(edit.voice?.volume ?? 1)
  const sfxVolume = edit.sfx?.muted ? 0 : Number(edit.sfx?.volume ?? 1)
  const musicStart = Math.max(0, Number(edit.music?.start ?? 0))
  const inputs = ['-i', musicFile]
  for (const line of vo.lines) inputs.push('-i', path.resolve(line.file))
  const base = 1 + vo.lines.length
  inputs.push('-i', sfx.whoosh, '-i', sfx.impact, '-i', sfx.tick)
  const whooshIndex = base
  const impactIndex = base + 1
  const tickIndex = base + 2

  const filters = []
  const mixes = []
  const voiceLabels = []

  vo.lines.forEach((line, index) => {
    const start = timing.scenes[index].voiceStart
    const ms = Math.max(0, Math.round(start * 1000))
    filters.push(`[${index + 1}:a]adelay=${ms}|${ms},volume=${voiceVolume}[vo${index}]`)
    voiceLabels.push(`[vo${index}]`)
  })

  if (voiceLabels.length) {
    const attack = Number(ducking.attack ?? 120)
    const release = Number(ducking.release ?? 800)
    const ratio = Number(ducking.ratio ?? 4)
    const threshold = Number(ducking.threshold ?? 0.01)
    filters.push(`${voiceLabels.join('')}amix=inputs=${voiceLabels.length}:duration=longest:normalize=0,apad=whole_dur=${duration},atrim=0:${duration},volume=1.0,asplit=2[voicebus][sc]`)
    const startFilter = musicStart > 0
      ? `adelay=${Math.round(musicStart * 1000)}|${Math.round(musicStart * 1000)},apad=whole_dur=${duration},`
      : ''
    filters.push(`[0:a]volume=${musicVolume},${startFilter}atrim=0:${duration}[musicraw]`)
    filters.push(`[musicraw][sc]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[music]`)
    mixes.push('[music]', '[voicebus]')
  } else {
    const startFilter = musicStart > 0
      ? `adelay=${Math.round(musicStart * 1000)}|${Math.round(musicStart * 1000)},apad=whole_dur=${duration},`
      : ''
    filters.push(`[0:a]volume=${musicVolume},${startFilter}atrim=0:${duration}[music]`)
    mixes.push('[music]')
  }

  const transitions = timing.scenes.slice(1)
  filters.push(`[${whooshIndex}:a]asplit=${transitions.length}${transitions.map((_, i) => `[wh${i}]`).join('')}`)
  transitions.forEach((scene, index) => {
    const ms = Math.max(0, Math.round((scene.start - 0.16) * 1000))
    filters.push(`[wh${index}]adelay=${ms}|${ms},volume=${(0.45 * sfxVolume).toFixed(3)}[w${index}]`)
    mixes.push(`[w${index}]`)
  })

  const impacts = [timing.scenes[1], timing.scenes[4]].filter(Boolean)
  filters.push(`[${impactIndex}:a]asplit=${Math.max(1, impacts.length)}${impacts.map((_, i) => `[im${i}]`).join('')}`)
  impacts.forEach((scene, index) => {
    const ms = Math.max(0, Math.round(scene.start * 1000))
    filters.push(`[im${index}]adelay=${ms}|${ms},volume=${(0.30 * sfxVolume).toFixed(3)}[impact${index}]`)
    mixes.push(`[impact${index}]`)
  })

  const ticks = [timing.scenes[2], timing.scenes[3]].filter(Boolean)
  filters.push(`[${tickIndex}:a]asplit=${Math.max(1, ticks.length)}${ticks.map((_, i) => `[tk${i}]`).join('')}`)
  ticks.forEach((scene, index) => {
    const ms = Math.max(0, Math.round(scene.start * 1000))
    filters.push(`[tk${index}]adelay=${ms}|${ms},volume=${(0.35 * sfxVolume).toFixed(3)}[t${index}]`)
    mixes.push(`[t${index}]`)
  })

  filters.push(`${mixes.join('')}amix=inputs=${mixes.length}:duration=first:normalize=0,atrim=0:${duration}[a]`)
  run([...inputs, '-filter_complex', filters.join(';'), '-map', '[a]', '-ac', '2', '-ar', '48000', dest], 'mix')
}

function measureLoudness(file) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' })
  const match = /\{[\s\S]*\}/.exec(result.stderr || '')
  if (!match) throw new Error('无法测量响度')
  return JSON.parse(match[0])
}

function normalize(input, output) {
  const measured = measureLoudness(input)
  const filter = [
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
  ].join(':')
  run(['-i', input, '-af', filter, '-ac', '2', '-ar', '48000', output], 'normalize')
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/audio-mix.mjs --project projects/<id> [--out out/<id>]')
  const projectDir = path.resolve(projectArg)
  const script = readJson(path.join(projectDir, 'script.json'))
  const outDir = path.resolve(arg('out', path.join('out', script.id)))
  const timing = readJson(path.join(outDir, 'timing.json'))
  const vo = readJson(path.join(outDir, 'vo', 'vo.json'))
  const audioDir = path.join(outDir, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })

  const rawMix = path.join(outDir, 'mix-raw.wav')
  const mixFile = path.join(outDir, 'mix.wav')
  const ducking = {
    ...(script.ducking || {}),
  }
  if (arg('duck-attack')) ducking.attack = Number(arg('duck-attack'))
  if (arg('duck-release')) ducking.release = Number(arg('duck-release'))
  if (arg('duck-ratio')) ducking.ratio = Number(arg('duck-ratio'))
  if (arg('duck-threshold')) ducking.threshold = Number(arg('duck-threshold'))
  const edit = readJson(path.join(projectDir, 'edit.json'), {})

  const bgmSource = ['bgm.mp3', 'bgm.wav', 'bgm.m4a'].map((name) => path.join(outDir, name)).find((file) => fs.existsSync(file))
  const musicFile = path.join(audioDir, bgmSource ? 'bgm.wav' : 'music.wav')
  if (bgmSource) {
    console.error(`[audio-mix] bgm: ${path.relative(process.cwd(), bgmSource).replace(/\\/g, '/')}`)
    buildBgm(bgmSource, musicFile, timing.duration)
  } else {
    buildMusic(musicFile, timing.duration)
  }

  const sfx = buildSfx(audioDir, outDir)
  buildMix(musicFile, sfx, timing, vo, rawMix, Boolean(bgmSource), ducking, edit)
  normalize(rawMix, mixFile)
  fs.rmSync(rawMix, { force: true })

  console.log(JSON.stringify({
    ok: true,
    mix: path.relative(process.cwd(), mixFile).replace(/\\/g, '/'),
    music: path.relative(process.cwd(), musicFile).replace(/\\/g, '/'),
    bgm: bgmSource ? path.relative(process.cwd(), bgmSource).replace(/\\/g, '/') : null,
    sfx: Object.fromEntries(Object.entries(sfx.custom).filter(([, value]) => value).map(([key, value]) => [key, path.relative(process.cwd(), value).replace(/\\/g, '/')])),
    ducking,
    duration: probe(mixFile),
  }, null, 2))
}

main()
