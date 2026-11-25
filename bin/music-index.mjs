#!/usr/bin/env node
/**
 * Rebuild library/music/catalog.json from the local Open Lo-Fi folder.
 *
 *   node bin/music-index.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const ROOT = process.cwd()
const LIB = path.join(ROOT, 'library', 'music')
const DIR = path.join(LIB, 'openlofi')
const META = path.join(LIB, 'openlofi.catalog.json')
const MOODS = {
  activities: 'focused',
  'late-night': 'moody',
  'ambient-lofi': 'calm',
  'asian-lofi': 'calm',
  hybrid: 'cinematic',
  jazzhop: 'warm',
  chillhop: 'relaxed',
  'soul-rnb': 'warm',
  'funk-soul': 'upbeat',
  'seasonal-weather': 'calm',
}
const STOP = new Set(['the', 'and', 'for', 'with', 'into', 'over', 'under', 'from', 'your', 'you', 'that', 'this', 'are', 'loop', 'open', 'lofi', 'lo', 'fi'])

function probeDuration(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 20000 }, (error, stdout) => {
      resolve(error ? 0 : Number(String(stdout).trim()) || 0)
    })
  })
}
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}
function tagsFor(title, category) {
  const tags = new Set(['lofi', category])
  const words = String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
  for (const word of words) {
    if (word.length < 3 || STOP.has(word) || /^\d+$/.test(word)) continue
    tags.add(word)
  }
  return [...tags].slice(0, 9)
}

async function main() {
  if (!fs.existsSync(DIR)) throw new Error(`找不到目录：${DIR}`)
  const meta = JSON.parse(fs.readFileSync(META, 'utf8').replace(/^\uFEFF/, ''))
  const byFile = new Map(meta.tracks.map((track) => [track.filename, track]))
  const categoryLabels = new Map(meta.categories.map((item) => [item.slug, item.label]))
  const files = fs.readdirSync(DIR).filter((file) => /\.mp3$/i.test(file)).sort()

  const tracks = await mapLimit(files, 8, async (file) => {
    const info = byFile.get(file) || { title: file.replace(/\.mp3$/i, '').replace(/-/g, ' '), category: 'activities' }
    const category = info.category || 'activities'
    const duration = await probeDuration(path.join(DIR, file))
    return {
      id: `openlofi-${file.replace(/\.mp3$/i, '')}`,
      title: info.title,
      file: `openlofi/${file}`,
      category,
      categoryLabel: categoryLabels.get(category) || category,
      tags: tagsFor(info.title, category),
      mood: MOODS[category] || 'calm',
      duration: Number(duration.toFixed(3)),
      license: 'CC0-1.0',
      source: 'https://github.com/btahir/open-lofi',
      attribution: 'Open Lo-Fi',
    }
  })

  const categories = [...new Set(tracks.map((track) => track.category))].map((category) => ({
    category,
    label: categoryLabels.get(category) || category,
    count: tracks.filter((track) => track.category === category).length,
  }))

  const catalog = {
    name: 'NutCut Music Library',
    version: 2,
    license: 'CC0-1.0',
    description: 'CC0 lo-fi background music from Open Lo-Fi.',
    trackCount: tracks.length,
    categories,
    tracks,
  }
  fs.writeFileSync(path.join(LIB, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ ok: true, trackCount: tracks.length, categories: categories.map((item) => `${item.category}:${item.count}`) }, null, 2))
}

main()
