#!/usr/bin/env node
/**
 * NutCut music selector.
 *
 *   node bin/music.mjs --list
 *   node bin/music.mjs --random --tag ambient
 *   node bin/music.mjs --remote --random --tag cinematic
 *   node bin/music.mjs --project projects/ai-for-ordinary-people --remote --random --style cinematic
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

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

function formatDuration(seconds) {
  const value = Number(seconds || 0)
  return `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
}

async function downloadRemote(track, source) {
  const dir = path.resolve('library', 'music', 'remote')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, track.file)
  if (fs.existsSync(file) && fs.statSync(file).size > 1024) return file

  try {
    console.error(`[music] downloading ${track.title} ← ${track.url}`)
    const response = await fetch(track.url, { signal: AbortSignal.timeout(180000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 1024) throw new Error('下载文件过小')
    fs.writeFileSync(file, bytes)
    return file
  } catch (error) {
    console.warn(`[music] direct download failed (${error.message}); using git cache`)
  }

  const cache = path.resolve('library', 'music', '.cache', 'duru')
  if (!fs.existsSync(cache)) {
    fs.mkdirSync(path.dirname(cache), { recursive: true })
    console.error(`[music] cloning CC0 source: ${source}`)
    const clone = spawnSync('git', ['clone', '--depth', '1', source, cache], { encoding: 'utf8' })
    if (clone.status !== 0) throw new Error(`git clone 失败：${(clone.stderr || '').slice(-600)}`)
  }
  const cached = path.join(cache, 'mp3', path.basename(track.file))
  if (!fs.existsSync(cached)) throw new Error(`远程曲目不存在：${cached}`)
  fs.copyFileSync(cached, file)
  return file
}

async function main() {
  const catalog = readJson(arg('catalog') || path.join('library', 'music', 'catalog.json'), { tracks: [] })
  const remote = readJson(path.join('library', 'music', 'remote.json'), { tracks: [] })
  const includeRemote = has('remote') || has('fresh')
  let tracks = includeRemote
    ? [...catalog.tracks.map((track) => ({ ...track, remote: false })), ...remote.tracks.map((track) => ({ ...track, remote: true }))]
    : catalog.tracks.map((track) => ({ ...track, remote: false }))

  const tag = arg('tag') || arg('style')
  const category = arg('category')
  const mood = arg('mood')
  const minDuration = Number(arg('min-duration', '0'))
  const maxDuration = Number(arg('max-duration', '99999'))

  if (tag) tracks = tracks.filter((track) => (track.tags || []).includes(tag) || track.category === tag)
  if (category) tracks = tracks.filter((track) => track.category === category)
  if (mood) tracks = tracks.filter((track) => track.mood === mood)
  tracks = tracks.filter((track) => track.duration >= minDuration && track.duration <= maxDuration)

  if (has('list') || (!has('random') && !arg('id'))) {
    if (has('json')) {
      console.log(JSON.stringify({ catalog: catalog.name, count: tracks.length, tracks }, null, 2))
      return
    }
    console.log(`${catalog.name} · ${tracks.length} tracks · ${catalog.license}${includeRemote ? ' + remote CC0' : ''}`)
    for (const track of tracks) {
      console.log(`${track.id.padEnd(38)} ${formatDuration(track.duration).padStart(5)}  ${track.category.padEnd(15)} ${track.remote ? '[REMOTE] ' : ''}${track.tags.join(',')}`)
    }
    return
  }

  let selected = null
  const id = arg('id')
  if (id) {
    selected = tracks.find((track) => track.id === id)
    if (!selected) throw new Error(`找不到曲目：${id}`)
  } else {
    if (!tracks.length) throw new Error('没有符合筛选条件的曲目')
    selected = tracks[Math.floor(Math.random() * tracks.length)]
  }

  let source = selected.remote
    ? await downloadRemote(selected, remote.source)
    : path.resolve('library', 'music', selected.file)
  if (!fs.existsSync(source)) throw new Error(`曲目文件不存在：${source}`)

  const projectArg = arg('project')
  let output = null
  let bgmMeta = null
  if (projectArg) {
    const projectDir = path.resolve(projectArg)
    const project = readJson(path.join(projectDir, 'project.json'))
    const outDir = path.resolve('out', project.id)
    fs.mkdirSync(outDir, { recursive: true })
    output = path.join(outDir, 'bgm.mp3')
    fs.copyFileSync(source, output)
    bgmMeta = {
      id: selected.id,
      title: selected.title,
      file: rel(output),
      sourceFile: rel(source),
      sourceUrl: selected.remote ? selected.url : selected.source,
      remote: Boolean(selected.remote),
      category: selected.category,
      tags: selected.tags,
      mood: selected.mood,
      duration: selected.duration,
      license: selected.license,
      source: selected.source,
      attribution: selected.attribution,
      selectedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(outDir, 'bgm.json'), JSON.stringify(bgmMeta, null, 2) + '\n', 'utf8')
    project.music = bgmMeta
    project.updatedAt = new Date().toISOString()
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(project, null, 2) + '\n', 'utf8')
  }

  console.log(JSON.stringify({
    ok: true,
    track: selected,
    source: rel(source),
    output: output ? rel(output) : null,
    bgm: bgmMeta,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
