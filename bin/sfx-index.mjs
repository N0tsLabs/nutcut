#!/usr/bin/env node
/**
 * Rebuild library/sfx/catalog.json from the local CC0 sound folders.
 *
 *   node bin/sfx-index.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { CATEGORY_ZH, localizeTrack } from '../src/sfx-zh.mjs'

const ROOT = process.cwd()
const LIB = path.join(ROOT, 'library', 'sfx')
const SOURCES = [
  {
    dir: 'motion',
    name: 'motion-graphics sound-effects',
    license: 'CC0-1.0',
    source: 'https://github.com/Barty-Bart/motion-graphics',
    attribution: 'Freesound contributors via motion-graphics (CC0)',
  },
  {
    dir: 'codebank',
    name: 'Built to Click code-made bank',
    license: 'CC0-1.0',
    source: 'https://github.com/Builttoclick/video-editing-playbook',
    attribution: 'Built to Click / earshot (CC0)',
  },
  {
    dir: 'meta',
    name: 'Meta Open Sound',
    license: 'CC0-1.0',
    source: 'https://github.com/facebookincubator/Meta-open-sound',
    attribution: 'Meta Open Sound (CC0)',
  },
  {
    dir: 'kenney',
    name: 'Kenney audio packs',
    license: 'CC0-1.0',
    source: 'https://kenney.nl/assets',
    attribution: 'Kenney (CC0)',
  },
]

const MOTION_SPECIAL = {
  'whoosh.ogg': { id: 'motion-whoosh', title: 'Whoosh', source: 'https://freesound.org/people/qubodup/sounds/60013/', attribution: 'qubodup via Freesound (CC0)' },
  'impact.ogg': { id: 'motion-impact', title: 'Soft Impact', source: 'https://freesound.org/people/peoplearehappy/sounds/841274/', attribution: 'peoplearehappy via Freesound (CC0)' },
  'tick.ogg': { id: 'motion-tick', title: 'Click Tick', source: 'https://freesound.org/people/Squirrel_404/sounds/683048/', attribution: 'Squirrel_404 via Freesound (CC0)' },
  'riser.ogg': { id: 'motion-riser', title: 'Cinematic Riser', source: 'https://freesound.org/people/BeaconStudio/sounds/859482/', attribution: 'BeaconStudio via Freesound (CC0)' },
}

const CODEBANK_BANK = {
  whoosh_big: 'transition', whoosh_fast: 'transition', pro_whoosh_big: 'transition', swish: 'transition', swipe: 'transition',
  riser: 'transition', pro_riser: 'transition', reverse_swell: 'transition', downlifter: 'transition',
  logo_sting: 'transition', pro_logo_sting: 'transition', pro_zip: 'transition',
  impact: 'impact', pro_impact: 'impact', cut_hit: 'impact', knock: 'impact', shutter: 'impact',
  sub_drop: 'impact', pro_sub_drop: 'impact',
  click: 'tick', tap: 'tick', toggle: 'tick', hover_tick: 'tick', pro_click: 'tick', pro_tap: 'tick',
  pro_hover_tick: 'tick', typing_key: 'typing', typing_run: 'typing', pro_typing_key: 'typing', pro_typing_run: 'typing',
  pop: 'pop', pro_pop: 'pop', ui_pop: 'pop', pro_pop_in: 'pop',
  notify: 'notify', pro_notify: 'notify', glitch: 'glitch', pro_glitch: 'glitch',
  shimmer: 'ui', pro_shimmer: 'ui', mallet: 'ui', pluck: 'ui', drip: 'pop', fit: 'pop',
}

const CODEBANK_KIT = {
  whoosh: 'transition', swish: 'transition', zip: 'transition', swell: 'transition',
  hit: 'impact', land: 'impact', crack: 'impact', shutter: 'impact',
  tick: 'tick', tock: 'tick', clock: 'tick', key: 'tick', scroll: 'tick',
  pop: 'pop', chip: 'pop', text: 'ui', tag: 'ui', send: 'ui', cross: 'ui', exit: 'ui',
  ding: 'notify', drip: 'pop', flood: 'ui', puff: 'ui',
}

function motionCategory(rel) {
  const normalized = rel.replaceAll('\\', '/')
  const [dir, file] = normalized.includes('/') ? normalized.split('/') : [normalized.replace(/\.[a-z0-9]+$/i, ''), '']
  if (!file) {
    if (dir === 'whoosh' || dir === 'riser') return 'transition'
    if (dir === 'impact') return 'impact'
    if (dir === 'tick') return 'tick'
    return 'ui'
  }
  if (dir === 'kit') {
    const name = String(file || '').toLowerCase()
    if (name.includes('whoosh') || name.includes('riser')) return 'transition'
    if (name.includes('impact')) return 'impact'
    if (name.includes('tick') || name.includes('click')) return 'tick'
    return 'ui'
  }
  return {
    whoosh: 'transition', transition: 'transition', riser: 'transition',
    impact: 'impact', tick: 'tick', click: 'tick',
    pop: 'pop', ding: 'notify', glitch: 'glitch', typing: 'typing', 'ui-blip': 'ui',
    ambience: 'ambience',
  }[dir] || 'ui'
}

function codebankCategory(rel) {
  const parts = rel.replaceAll('\\', '/').split('/')
  const [kind, folder, file] = parts
  const base = path.basename(file || '', path.extname(file || ''))
  if (kind === 'bank') return CODEBANK_BANK[folder] || 'ui'
  const head = base.split(/[-_]/)[0]
  return CODEBANK_KIT[head] || 'ui'
}

function metaCategory(rel) {
  const name = path.basename(rel)
  if (/^(WHSH_|SWSH_)/.test(name)) return 'transition'
  if (/^(PAPR|OBJBook|CLOTHMvmt|VEGELeaf_)/.test(name)) return 'foley'
  if (/^UIClick_/.test(name)) return 'tick'
  if (/^UIAlert_/.test(name)) return 'notify'
  if (/^TOONBoing_/.test(name)) return 'pop'
  if (/^(UIMisc_|UIData_|MUSCStngr_)/.test(name)) return 'ui'
  if (/^(CLOCKTick|MECHSwtch|MECHLock)/.test(name)) return 'tick'
  if (/^(METLImpt_|CERMImpt_|WOODImpt_|GLASImpt_|PLASImpt_|OBJCoin_|OBJKey_|FGHTImpt_|DOORWood_|DOORMetl_|DOORGlas_|DRWRWood_|OBJLug_|OBJBag_)/.test(name)) return 'impact'
  if (/^(AMB|RAIN|WIND|WATR|CRWD|MACH)/.test(name)) return 'ambience'
  return 'ui'
}

function kenneyCategory(rel) {
  if (rel.includes('impact')) return 'impact'
  if (rel.includes('tick')) return 'tick'
  return 'ui'
}

function categoryFor(sourceDir, rel) {
  if (sourceDir === 'motion') return motionCategory(rel.replaceAll('\\', '/'))
  if (sourceDir === 'codebank') return codebankCategory(rel)
  if (sourceDir === 'meta') return metaCategory(rel)
  return kenneyCategory(rel.replaceAll('\\', '/'))
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SOURCE_WORDS = {
  PAPRHndl: 'Paper Handling', PAPRImpt: 'Paper', PAPRRip: 'Paper Rip',
  OBJBook: 'Book', CLOTHMvmt: 'Cloth', VEGELeaf: 'Leaves',
  UIClick: 'UI Click', UIAlert: 'UI Alert', UIMisc: 'UI', UIData: 'UI Data',
  AMBHome: 'Room Tone', AMBUrbn: 'City', AMBForst: 'Forest', AMBSea: 'Sea',
  WHSH: 'Whoosh', SWSH: 'Swoosh',
  CLOCKTick: 'Clock', MECHSwtch: 'Switch', MECHLock: 'Lock',
  METLImpt: 'Metal', CERMImpt: 'Ceramic', WOODImpt: 'Wood', GLASImpt: 'Glass', PLASImpt: 'Plastic',
  OBJCoin: 'Coin', OBJKey: 'Key', FGHTImpt: 'Hit', TOONBoing: 'Boing',
  MUSCStngr: 'Stinger', DOORWood: 'Wood Door', DOORMetl: 'Metal Door', DOORGlas: 'Glass Door',
  DRWRWood: 'Drawer', OBJLug: 'Luggage', OBJBag: 'Bag', RAIN: 'Rain', WINDVege: 'Wind',
  WATRFlow: 'Water', WATRLap: 'Water Lap', WATRWave: 'Waves', CRWDConv: 'Crowd',
  MACHHvac: 'HVAC', MACHFan: 'Fan',
}
const SOURCE_PREFIX = new RegExp(`^(${Object.keys(SOURCE_WORDS).sort((a, b) => b.length - a.length).join('|')})(?=[A-Z_\\- ]|$)`)

function titleFor(rel, sourceDir) {
  const normalized = rel.replaceAll('\\', '/')
  const parts = normalized.split('/')
  const folder = sourceDir === 'motion'
    ? (parts.length > 1 ? parts[0] : '')
    : (parts.length > 2 ? parts[1] : '')
  let base = path.basename(parts.at(-1), path.extname(parts.at(-1)))
  base = base.replace(/^fs-\d+-/, '')
  base = base.replace(SOURCE_PREFIX, (match) => `${SOURCE_WORDS[match]} `)
  base = base
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+(OS|LOOP)\s*(\d+)$/i, ' $2')
    .replace(/\s+/g, ' ')
    .trim()
  const title = base.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\b([A-Za-z]+)\s+\1\b/g, '$1')
  if (sourceDir === 'codebank' && folder && folder !== 'kit') {
    return `${folder.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())} · ${title}`
  }
  if (sourceDir === 'codebank' && folder === 'kit') {
    return `Kit · ${title}`
  }
  if (sourceDir === 'motion' && folder && folder !== 'kit' && !title.toLowerCase().includes(folder.toLowerCase())) {
    return `${folder.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())} · ${title}`
  }
  return title
}

function tagsFor(rel, category) {
  const tokens = new Set([category])
  const cleaned = rel
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
  for (const token of cleaned) {
    if (token.length < 3 || token.length > 18) continue
    if (['ogg', 'wav', 'mp3', 'm4a', 'aif', 'loop', 'motion', 'kenney', 'codebank', 'meta', 'bank', 'kit'].includes(token)) continue
    if (/^\d+$/.test(token) || /^fs\d+/.test(token)) continue
    tokens.add(token)
  }
  return [...tokens].slice(0, 8)
}

function probeDuration(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 15000 }, (error, stdout) => {
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

async function main() {
  const entries = []
  for (const source of SOURCES) {
    const base = path.join(LIB, source.dir)
    if (!fs.existsSync(base)) continue
    for (const rel of fs.readdirSync(base, { recursive: true })) {
      const full = path.join(base, rel)
      if (!fs.statSync(full).isFile()) continue
      if (!/\.(ogg|wav|mp3|m4a)$/i.test(rel)) continue
      entries.push({ source, rel, full })
    }
  }

  const seen = new Set()
  const tracks = await mapLimit(entries, 8, async ({ source, rel, full }, index) => {
    const normalized = rel.replaceAll('\\', '/')
    const sourceRel = normalized
    const category = categoryFor(source.dir, sourceRel)
    const special = source.dir === 'motion' ? MOTION_SPECIAL[sourceRel] : null
    let id = special?.id || `${source.dir}-${slugify(sourceRel)}`
    if (seen.has(id)) id = `${id}-${index}`
    seen.add(id)
    const duration = await probeDuration(full)
    return localizeTrack({
      id,
      title: special?.title || titleFor(sourceRel, source.dir),
      file: `${source.dir}/${sourceRel}`,
      path: `library/sfx/${source.dir}/${sourceRel}`,
      category,
      tags: tagsFor(sourceRel, category),
      duration: Number(duration.toFixed(3)),
      license: source.license,
      source: special?.source || source.source,
      attribution: special?.attribution || source.attribution,
    })
  })

  const order = { transition: 0, impact: 1, tick: 2, pop: 3, notify: 4, typing: 5, glitch: 6, ui: 7, foley: 8, ambience: 9 }
  tracks.sort((a, b) => {
    const rank = (order[a.category] ?? 9) - (order[b.category] ?? 9)
    if (rank) return rank
    return a.title.localeCompare(b.title)
  })

  const categories = [...new Set(tracks.map((track) => track.category))].map((category) => ({
    category,
    categoryZh: CATEGORY_ZH[category] || category,
    count: tracks.filter((track) => track.category === category).length,
    tags: [...new Set(tracks.filter((track) => track.category === category).flatMap((track) => track.tags))].slice(0, 24),
  }))

  const catalog = {
    name: 'NutCut SFX Library',
    version: 2,
    license: 'CC0-1.0',
    trackCount: tracks.length,
    categories,
    sources: SOURCES.map((source) => ({
      dir: source.dir,
      name: source.name,
      license: source.license,
      source: source.source,
      count: tracks.filter((track) => track.file.startsWith(`${source.dir}/`)).length,
    })),
    tracks,
  }
  fs.writeFileSync(path.join(LIB, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ ok: true, trackCount: tracks.length, categories: categories.map((item) => `${item.category}:${item.count}`), sources: catalog.sources }, null, 2))
}

main()
