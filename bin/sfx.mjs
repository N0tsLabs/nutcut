#!/usr/bin/env node
/**
 * NutCut SFX selector.
 *
 *   node bin/sfx.mjs --list
 *   node bin/sfx.mjs --project projects/ai-for-ordinary-people --set default
 *   node bin/sfx.mjs --project projects/ai-for-ordinary-people --kind transition --random --tag soft
 */
import fs from 'node:fs'
import path from 'node:path'
import { CATEGORY_ZH } from '../src/sfx-zh.mjs'

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

const DEFAULTS = {
  transition: 'motion-whoosh',
  impact: 'motion-impact',
  tick: 'motion-tick',
}

function main() {
  const catalog = readJson(path.join('library', 'sfx', 'catalog.json'), { tracks: [] })
  let tracks = catalog.tracks || []
  const category = arg('category')
  const tag = arg('tag')
  const kind = arg('kind')
  if (category) tracks = tracks.filter((track) => track.category === category)
  if (kind) tracks = tracks.filter((track) => track.category === kind)
  if (tag) tracks = tracks.filter((track) => (track.tags || []).includes(tag))

  if (has('list') || (!has('random') && !arg('id') && !has('set') && !kind)) {
    if (has('json')) {
      console.log(JSON.stringify({ catalog: catalog.name, count: tracks.length, tracks }, null, 2))
      return
    }
    console.log(`${catalog.name} · ${tracks.length}/${catalog.trackCount} · ${catalog.license}`)
    for (const track of tracks) {
      const title = track.titleZh || track.title
      console.log(`${track.id.padEnd(42)} ${String(track.duration).padStart(6)}s  ${(track.categoryZh || CATEGORY_ZH[track.category] || track.category).padEnd(4)}  ${title}`)
    }
    return
  }

  const selected = []
  if (has('set')) {
    for (const [kindName, id] of Object.entries(DEFAULTS)) {
      const track = catalog.tracks.find((item) => item.id === id)
      if (track) selected.push(track)
    }
  } else {
    let chosen = null
    const id = arg('id')
    if (id) {
      chosen = tracks.find((track) => track.id === id)
      if (!chosen) throw new Error(`找不到音效：${id}`)
    } else {
      if (!tracks.length) throw new Error('没有符合筛选条件的音效')
      chosen = tracks[Math.floor(Math.random() * tracks.length)]
    }
    selected.push(chosen)
  }

  const projectArg = arg('project')
  let copied = []
  let sfxMeta = null
  if (projectArg) {
    const projectDir = path.resolve(projectArg)
    const project = readJson(path.join(projectDir, 'project.json'))
    const outDir = path.resolve('out', project.id)
    const sfxDir = path.join(outDir, 'sfx')
    fs.mkdirSync(sfxDir, { recursive: true })
    sfxMeta = {}
    for (const track of selected) {
      const source = path.resolve(track.path || path.join('library', 'sfx', 'kenney', track.file))
      if (!fs.existsSync(source)) throw new Error(`音效文件不存在：${source}`)
      const ext = path.extname(source).toLowerCase() || '.ogg'
      for (const oldExt of ['.ogg', '.wav', '.mp3', '.m4a']) {
        const stale = path.join(sfxDir, `${track.category}${oldExt}`)
        if (stale !== path.join(sfxDir, `${track.category}${ext}`)) fs.rmSync(stale, { force: true })
      }
      const output = path.join(sfxDir, `${track.category}${ext}`)
      fs.copyFileSync(source, output)
      copied.push(rel(output))
      sfxMeta[track.category] = {
        id: track.id,
        title: track.title,
        titleZh: track.titleZh || track.title,
        file: rel(output),
        sourceFile: rel(source),
        category: track.category,
        categoryZh: track.categoryZh || CATEGORY_ZH[track.category] || track.category,
        tags: track.tags,
        tagsZh: track.tagsZh || [],
        duration: track.duration,
        license: track.license,
        source: track.source,
        attribution: track.attribution,
        selectedAt: new Date().toISOString(),
      }
    }
    fs.writeFileSync(path.join(outDir, 'sfx.json'), JSON.stringify(sfxMeta, null, 2) + '\n', 'utf8')
    project.sfx = sfxMeta
    project.updatedAt = new Date().toISOString()
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(project, null, 2) + '\n', 'utf8')
  }

  console.log(JSON.stringify({ ok: true, selected, files: copied, sfx: sfxMeta }, null, 2))
}

main()
