#!/usr/bin/env node
/**
 * Build a deterministic timeline from script.json + out/<id>/vo/vo.json.
 * Writes out/<id>/timing.json, projects/<id>/src/timings.js, and updates motion.json duration.
 *
 *   node bin/timeline.mjs --project projects/ai-for-ordinary-people
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits))
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/timeline.mjs --project projects/<id> [--out out/<id>]')
  const projectDir = path.resolve(projectArg)
  const script = readJson(path.join(projectDir, 'script.json'))
  const outDir = path.resolve(arg('out', path.join('out', script.id)))
  const voPath = path.join(outDir, 'vo', 'vo.json')
  if (!fs.existsSync(voPath)) throw new Error(`缺少 vo.json，请先运行 bin/voice.mjs：${voPath}`)
  const vo = readJson(voPath)
  if (vo.lines.length !== script.lines.length) {
    throw new Error(`vo.json 行数 ${vo.lines.length} 与 script.json ${script.lines.length} 不一致`)
  }

  const intro = Number(script.intro ?? 1.2)
  const gap = Number(script.gap ?? 0.45)
  const outro = Number(script.outro ?? 2.2)
  let cursor = intro
  const scenes = []

  vo.lines.forEach((line, index) => {
    const voiceStart = cursor
    const voiceEnd = voiceStart + line.duration
    const sceneStart = index === 0 ? 0 : Math.max(0, voiceStart - 0.35)
    const nextVoiceStart = voiceEnd + gap
    const sceneEnd = index === vo.lines.length - 1
      ? voiceEnd + outro
      : Math.max(voiceStart + 0.5, nextVoiceStart - 0.1)
    scenes.push({
      scene: line.scene,
      line: line.id,
      start: round(sceneStart),
      end: round(sceneEnd),
      voiceStart: round(voiceStart),
      voiceEnd: round(voiceEnd),
      duration: round(line.duration),
    })
    cursor = nextVoiceStart
  })

  const duration = round(scenes[scenes.length - 1].end)
  const timing = {
    project: script.id,
    title: script.title,
    duration,
    fps: 30,
    intro,
    gap,
    outro,
    scenes,
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'timing.json'), JSON.stringify(timing, null, 2) + '\n', 'utf8')

  const js = `window.__timeline = ${JSON.stringify({
    duration,
    fps: 30,
    scenes: scenes.map(({ scene, line, start, end, voiceStart, voiceEnd }) => ({ scene, line, start, end, voiceStart, voiceEnd })),
  }, null, 2)};\n`
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'src', 'timings.js'), js, 'utf8')

  const manifestPath = path.join(projectDir, 'motion.json')
  const manifest = readJson(manifestPath)
  manifest.output.duration = duration
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(JSON.stringify({
    ok: true,
    duration,
    timing: path.relative(process.cwd(), path.join(outDir, 'timing.json')).replace(/\\/g, '/'),
    timings: path.relative(process.cwd(), path.join(projectDir, 'src', 'timings.js')).replace(/\\/g, '/'),
    scenes,
  }, null, 2))
}

main()
