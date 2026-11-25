#!/usr/bin/env node
/**
 * End-to-end producer: script.json → voice → timeline → mix → silent render → final MP4 → poster → project.json.
 *
 *   node bin/produce.mjs --project projects/ai-for-ordinary-people
 *   node bin/produce.mjs --project projects/ai-for-ordinary-people --skip-voice --skip-render
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { projectRenderBlock } from '../src/spec.mjs'

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

function run(command, args, label) {
  console.log(`\n[nutcut] ${label}`)
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${label} 失败`)
}

function rel(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, '/')
}

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/produce.mjs --project projects/<id> [--skip-voice] [--skip-mix] [--skip-render] [--force-voice]')
  const projectDir = path.resolve(projectArg)
  const scriptPath = path.join(projectDir, 'script.json')
  if (!fs.existsSync(scriptPath)) throw new Error(`缺少 script.json：${scriptPath}`)
  const script = readJson(scriptPath)
  const projectData = readJson(path.join(projectDir, 'project.json'), null)
  const blocked = projectRenderBlock(projectData)
  if (blocked) throw new Error(blocked)
  const outDir = path.resolve(arg('out', path.join('out', script.id)))
  fs.mkdirSync(outDir, { recursive: true })

  if (!has('skip-voice')) {
    run('node', ['bin/voice.mjs', '--project', projectArg, ...(has('force-voice') ? ['--force'] : [])], '1/6 生成声音')
  }
  run('node', ['bin/timeline.mjs', '--project', projectArg], '2/6 计算时间线')
  if (!has('skip-mix')) {
    run('node', ['bin/audio-mix.mjs', '--project', projectArg], '3/6 混音')
  } else if (!fs.existsSync(path.join(outDir, 'mix.wav'))) {
    throw new Error('--skip-mix 需要已有的 out/<id>/mix.wav')
  }

  const silent = path.join(outDir, 'film-silent.mp4')
  if (!has('skip-render')) {
    run('node', ['bin/render.mjs', '--template', projectArg, '--out', silent], '4/6 渲染画面')
  }

  const mix = path.join(outDir, 'mix.wav')
  const final = path.join(outDir, 'film.mp4')
  if (!fs.existsSync(silent)) throw new Error(`缺少无声渲染：${silent}`)
  if (!fs.existsSync(mix)) throw new Error(`缺少混音：${mix}`)
  run('ffmpeg', [
    '-y', '-v', 'error',
    '-i', silent,
    '-i', mix,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    final,
  ], '5/6 合成音轨')

  const poster = path.join(outDir, 'poster.png')
  run('ffmpeg', ['-y', '-v', 'error', '-ss', '3', '-i', final, '-frames:v', '1', poster], '6/6 导出封面')
  const preview = path.join(projectDir, 'preview.jpg')
  run('ffmpeg', ['-y', '-v', 'error', '-i', poster, '-q:v', '3', preview], '导出模板封面')

  const timing = readJson(path.join(outDir, 'timing.json'), {})
  const vo = readJson(path.join(outDir, 'vo', 'vo.json'), { lines: [] })
  const projectFile = path.join(projectDir, 'project.json')
  const old = readJson(projectFile, {})
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate', '-of', 'json', final], { encoding: 'utf8' })
  let info = {}
  try { info = JSON.parse(probe.stdout) } catch {}
  const videoStream = info.streams?.find((stream) => stream.codec_name === 'h264') || {}
  const fps = (() => {
    const [num, den] = String(videoStream.r_frame_rate || '').split('/').map(Number)
    if (num && den) return Math.round(num / den)
    return Number(old.tech?.fps || 30)
  })()
  const generatedDir = path.join(projectDir, 'assets', 'generated')
  const images = fs.existsSync(generatedDir)
    ? fs.readdirSync(generatedDir).filter((file) => /\.(png|jpe?g|webp)$/i.test(file)).map((file) => rel(path.join(generatedDir, file)))
    : []
  const project = {
    ...old,
    id: script.id,
    title: script.title || old.title || script.id,
    subtitle: script.subtitle || old.subtitle || 'NutCut 短片',
    summary: script.summary || old.summary || '',
    status: 'review',
    stage: 'review',
    duration: timing.duration ?? old.duration ?? null,
    tags: script.tags || old.tags || [],
    voiceProfile: script.voice || old.voiceProfile || 'me',
    template: old.template || script.template || null,
    spec: old.spec || script.spec || null,
    templateNative: old.templateNative || null,
    layoutAdapted: old.layoutAdapted,
    renderEngine: old.renderEngine || 'html',
    previewEngine: old.previewEngine || 'html',
    imports: old.imports || [],
    createdAt: old.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: {
      ...(old.assets || {}),
      video: rel(final),
      poster: rel(poster),
      mix: rel(mix),
      silent: rel(silent),
      template: rel(path.join(projectDir, 'src', 'index.html')),
      timings: rel(path.join(outDir, 'timing.json')),
      vo: rel(path.join(outDir, 'vo', 'vo.json')),
    },
    tech: {
      ...(old.tech || {}),
      width: videoStream.width || 1920,
      height: videoStream.height || 1080,
      fps,
      frames: Math.round(Number(timing.duration || 0) * fps),
      video: 'H.264',
      audio: 'AAC 48kHz stereo',
      loudness: '-16 LUFS',
      bytes: Number(info.format?.size || 0),
      bitrate: Number(info.format?.bit_rate || 0),
    },
    voiceLines: vo.lines || [],
    scenes: timing.scenes || [],
    images,
    music: old.music || null,
    sfx: old.sfx || null,
    pipeline: [
      { id: 'spec', label: '规格', status: old.spec?.confirmed ? 'done' : 'todo' },
      { id: 'idea', label: '想法', status: 'done' },
      { id: 'script', label: '文案', status: 'done' },
      { id: 'voice', label: '声音', status: 'done' },
      { id: 'render', label: '画面', status: 'done' },
      { id: 'mix', label: '混音', status: 'done' },
      { id: 'review', label: '待你确认', status: 'doing' },
    ],
    script: rel(scriptPath),
  }
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n', 'utf8')

  console.log(JSON.stringify({
    ok: true,
    project: rel(projectFile),
    video: rel(final),
    poster: rel(poster),
    duration: Number(info.format?.duration ?? timing.duration),
    bytes: info.format?.size,
  }, null, 2))
}

main()
