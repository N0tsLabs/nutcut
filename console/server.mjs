#!/usr/bin/env node
/**
 * NutCut Console — local control panel for projects, voiceovers and videos.
 *
 *   node console/server.mjs
 *   node console/server.mjs --port 4173
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { projectRenderBlock } from '../src/spec.mjs'
import { createProject, ProjectCreateError } from '../src/project-create.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const UI_DIR = path.join(ROOT, 'console', 'ui')
const MEDIA_ROOTS = ['out', 'projects', 'voices', 'library', 'templates'].map((dir) => path.join(ROOT, dir))
const STATUS_ZH = {
  idea: '想法', script: '文案', voice: '声音', render: '画面', mix: '混音',
  review: '待确认', done: '已完成', template: '模板', wip: '制作中',
}
const JOBS = new Map()

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const PORT = Number(process.env.NUTCUT_PORT || arg('port', '4173'))
const HOST = process.env.NUTCUT_HOST || '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return fallback
  }
}

function mediaUrl(relative) {
  if (!relative) return null
  const clean = String(relative).replace(/\\/g, '/').replace(/^\/+/, '')
  return `/media/${clean.split('/').map(encodeURIComponent).join('/')}`
}

function fileExists(relative) {
  return fs.existsSync(path.join(ROOT, String(relative).replace(/\\/g, '/')))
}

function fileBytes(relative) {
  try {
    return fs.statSync(path.join(ROOT, String(relative).replace(/\\/g, '/'))).size
  } catch {
    return 0
  }
}

function dirBytes(dir) {
  const target = path.join(ROOT, dir)
  if (!fs.existsSync(target)) return 0
  let total = 0
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const file = path.join(target, entry.name)
    if (entry.isDirectory()) total += dirBytes(path.join(dir, entry.name))
    else total += fs.statSync(file).size
  }
  return total
}

function readVoice() {
  const file = path.join(ROOT, 'voices', 'me', 'profile.json')
  const profile = readJson(file, null)
  if (!profile) return null
  const reference = path.join('voices', 'me', profile.reference || 'reference.wav')
  return {
    ...profile,
    sha256Short: profile.sha256 ? profile.sha256.slice(0, 16) : null,
    referenceUrl: fileExists(reference) ? mediaUrl(reference) : null,
    referenceBytes: fileBytes(reference),
    referenceExists: fileExists(reference),
  }
}

function normalizeAssets(assets = {}) {
  const out = {}
  for (const [key, value] of Object.entries(assets)) {
    if (!value) continue
    out[key] = fileExists(value) ? mediaUrl(value) : null
  }
  return out
}

function getIssues(project) {
  const data = readJson(path.join(ROOT, 'projects', project.dir, 'issues.json'), null)
  return data && typeof data === 'object' && !Array.isArray(data)
    ? { text: String(data.text || ''), updatedAt: data.updatedAt || null }
    : { text: '', updatedAt: null }
}

function getImports(project) {
  return readJson(path.join(ROOT, 'projects', project.dir, 'imports.json'), [])
}

function getEdit(project) {
  return readJson(path.join(ROOT, 'projects', project.dir, 'edit.json'), {
    version: 1,
    music: { volume: 1, muted: false, start: 0 },
    voice: { volume: 1, muted: false },
    sfx: { volume: 1, muted: false },
  })
}

function getBrief(project) {
  return readJson(path.join(ROOT, 'projects', project.dir, 'brief.json'), null)
}

function getTemplates() {
  const dir = path.join(ROOT, 'templates')
  if (!fs.existsSync(dir)) return []
  const items = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const templateDir = path.join(dir, entry.name)
    const meta = readJson(path.join(templateDir, 'template.json'), null)
    if (!meta) continue
    const motion = readJson(path.join(templateDir, 'motion.json'), {})
    const preview = meta.preview || 'preview.svg'
    const remotion = meta.remotion?.composition
      ? {
          composition: meta.remotion.composition,
          width: Number(meta.remotion.width || motion.output?.width || 1920),
          height: Number(meta.remotion.height || motion.output?.height || 1080),
          fps: Number(meta.remotion.fps || motion.output?.fps || 30),
          durationInFrames: Number(meta.remotion.durationInFrames || 300),
          previewOnly: meta.remotion.previewOnly !== false,
          props: {
            palette: meta.palette || {},
            ...(() => {
              const preset = readJson(path.join(templateDir, 'presets', 'default.json'), {})
              const picked = {}
              if (typeof preset.title === 'string' && preset.title) picked.title = preset.title
              if (typeof preset.subtitle === 'string' && preset.subtitle) picked.subtitle = preset.subtitle
              return picked
            })(),
            ...(meta.remotion.props || {}),
          },
        }
      : null
    items.push({
      ...meta,
      remotion,
      engine: remotion ? 'remotion' : 'html',
      dir: entry.name,
      width: Number(motion.output?.width || 1920),
      height: Number(motion.output?.height || 1080),
      fps: Number(motion.output?.fps || 30),
      duration: Number(motion.output?.duration || meta.duration || 10),
      hasSource: fs.existsSync(path.join(templateDir, 'src', 'index.html')),
      preview: fileExists(`templates/${entry.name}/${preview}`) ? mediaUrl(`templates/${entry.name}/${preview}`) : null,
    })
  }
  return items.sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)))
}

function publicJob(job) {
  if (!job) return null
  return {
    id: job.id,
    kind: job.kind,
    projectId: job.projectId,
    status: job.status,
    exitCode: job.exitCode,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    logs: job.logs.slice(-200),
  }
}

function startJob(kind, project, args) {
  for (const job of JOBS.values()) {
    if (job.projectId === project.id && job.status === 'running') {
      const error = new Error('这个项目已有任务在运行')
      error.status = 409
      throw error
    }
  }
  const id = `job_${crypto.randomUUID().slice(0, 8)}`
  const job = {
    id,
    kind,
    projectId: project.id,
    status: 'running',
    logs: [],
    startedAt: new Date().toISOString(),
  }
  const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env })
  const push = (chunk) => {
    for (const line of String(chunk).replace(/\r/g, '').split('\n')) {
      if (!line.trim()) continue
      job.logs.push(line)
      if (job.logs.length > 500) job.logs.shift()
    }
  }
  child.stdout.on('data', push)
  child.stderr.on('data', push)
  child.on('error', (error) => {
    job.logs.push(`启动失败：${error.message}`)
    job.status = 'failed'
    job.endedAt = new Date().toISOString()
  })
  child.on('close', (code) => {
    job.exitCode = code
    job.status = code === 0 ? 'done' : 'failed'
    job.endedAt = new Date().toISOString()
  })
  JOBS.set(id, job)
  return job
}

function fallbackProject(dir, motion, stat) {
  const assets = {
    template: `projects/${dir}/src/index.html`,
  }
  if (fs.existsSync(path.join(ROOT, 'projects', dir, 'preview.jpg'))) assets.poster = `projects/${dir}/preview.jpg`
  return {
    id: motion.id || dir,
    dir,
    title: motion.name || dir,
    subtitle: motion.description || 'OpenMotion 模板',
    status: 'template',
    stage: 'template',
    duration: motion.output?.duration ?? null,
    tags: motion.tags || [],
    summary: motion.description || '',
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
    assets: normalizeAssets(assets),
    pipeline: [],
    bytes: 0,
    frameCount: Math.round((motion.output?.duration ?? 0) * (motion.output?.fps ?? 30)),
  }
}

function listProjects() {
  const dir = path.join(ROOT, 'projects')
  if (!fs.existsSync(dir)) return []
  const projects = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const projectDir = path.join(dir, entry.name)
    const projectFile = path.join(projectDir, 'project.json')
    const motionFile = path.join(projectDir, 'motion.json')
    const stat = fs.statSync(projectDir)
    if (fs.existsSync(projectFile)) {
      const raw = readJson(projectFile, null)
      if (!raw) continue
      const imports = readJson(path.join(projectDir, 'imports.json'), [])
      const issues = readJson(path.join(projectDir, 'issues.json'), null)
      const issueText = issues && typeof issues.text === 'string' ? issues.text.trim() : ''
      const bytes = Object.values(raw.assets || {}).reduce((sum, value) => sum + fileBytes(value), 0)
        + (raw.images || []).reduce((sum, value) => sum + fileBytes(value), 0)
      projects.push({
        ...raw,
        dir: entry.name,
        assets: normalizeAssets(raw.assets || {}),
        issueCount: issueText ? 1 : 0,
        issuesUpdatedAt: issues?.updatedAt || null,
        importCount: Array.isArray(imports) ? imports.length : 0,
        bytes,
        frameCount: Math.round((raw.duration ?? 0) * (raw.tech?.fps ?? 30)),
        updatedAt: raw.updatedAt || stat.mtime.toISOString(),
      })
    } else if (fs.existsSync(motionFile)) {
      const motion = readJson(motionFile, null)
      if (motion) projects.push(fallbackProject(entry.name, motion, stat))
    }
  }
  return projects.sort((a, b) => {
    const rank = (p) => (p.status === 'template' ? 1 : 0)
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    return String(b.updatedAt).localeCompare(String(a.updatedAt))
  })
}

function getProject(id) {
  const project = listProjects().find((item) => item.id === id || item.dir === id)
  if (!project) return null
  const projectDir = path.join(ROOT, 'projects', project.dir)
  const vo = project.assets?.vo ? readJson(path.join(ROOT, project.assets.vo.replace(/^\/media\//, '').split('/').map(decodeURIComponent).join('/')), null) : null
  const scriptData = readJson(path.join(projectDir, 'script.json'), null)
  const fallbackLines = (scriptData?.lines || []).map((line) => ({ ...line, duration: 0, file: null }))
  const voiceLines = (project.voiceLines || vo?.lines || fallbackLines).map((line) => ({
    ...line,
    file: line.file ? (String(line.file).startsWith('/media/') ? line.file : mediaUrl(line.file)) : null,
  }))
  const sfxCatalog = readJson(path.join(ROOT, 'library', 'sfx', 'catalog.json'), { tracks: [] })
  const sfxById = new Map((sfxCatalog.tracks || []).map((track) => [track.id, track]))
  const sfx = project.sfx
    ? Object.fromEntries(Object.entries(project.sfx).map(([kind, item]) => {
        const track = sfxById.get(item?.id)
        return [kind, {
          ...item,
          titleZh: item.titleZh || track?.titleZh || item.title || '',
          categoryZh: item.categoryZh || track?.categoryZh || item.category,
          tagsZh: item.tagsZh || track?.tagsZh || [],
          file: item.file ? (String(item.file).startsWith('/media/') ? item.file : mediaUrl(item.file)) : null,
        }]
      }))
    : null
  const imports = getImports(project).map((item) => ({ ...item, url: mediaUrl(item.file) }))
  const templates = getTemplates()
  const template = templates.find((item) => item.id === project.template) || null
  return {
    ...project,
    sfx,
    voiceLines,
    issues: getIssues(project),
    imports,
    edit: getEdit(project),
    brief: getBrief(project),
    templateMeta: template,
  }
}

function getLibrary() {
  const music = readJson(path.join(ROOT, 'library', 'music', 'catalog.json'), { tracks: [] })
  const remote = readJson(path.join(ROOT, 'library', 'music', 'remote.json'), { tracks: [] })
  const sfx = readJson(path.join(ROOT, 'library', 'sfx', 'catalog.json'), { tracks: [] })
  return {
    ok: true,
    music: {
      name: music.name || 'Music Library',
      license: music.license || 'CC0-1.0',
      tracks: music.tracks || [],
      remote: (remote.tracks || []).map((track) => ({ ...track, remote: true })),
    },
    sfx: {
      name: sfx.name || 'SFX Library',
      license: sfx.license || 'CC0-1.0',
      tracks: (sfx.tracks || []).map((track) => ({
        ...track,
        preview: mediaUrl(track.path || `library/sfx/kenney/${track.file}`),
      })),
    },
  }
}

function getOverview() {
  const projects = listProjects()
  const films = projects.filter((project) => project.status !== 'template')
  const totalDuration = films.reduce((sum, project) => sum + Number(project.duration || 0), 0)
  const totalBytes = projects.reduce((sum, project) => sum + Number(project.bytes || 0), 0)
  const activity = []
  for (const project of projects) {
    activity.push({
      at: project.updatedAt,
      type: 'project',
      projectId: project.id,
      title: project.title,
      detail: `${STATUS_ZH[project.status] || project.status} · ${Number(project.duration || 0).toFixed(2)} 秒`,
    })
  }
  activity.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    voice: readVoice(),
    stats: {
      projects: projects.length,
      films: films.length,
      templates: projects.length - films.length,
      totalDuration,
      totalBytes,
      totalFrames: films.reduce((sum, project) => sum + Number(project.frameCount || 0), 0),
      issuesOpen: projects.reduce((sum, project) => sum + (getIssues(project).text.trim() ? 1 : 0), 0),
    },
    storage: {
      out: dirBytes('out'),
      projects: dirBytes('projects'),
      voices: dirBytes('voices'),
      library: dirBytes('library'),
    },
    system: {
      node: process.version,
      platform: process.platform,
      port: PORT,
      uptime: process.uptime(),
      root: ROOT,
    },
    activity: activity.slice(0, 12),
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 256 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('JSON 格式错误'))
      }
    })
    req.on('error', reject)
  })
}

function readBinary(req, limit = 512 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limit) {
        reject(new Error('文件超过 512MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function isAllowed(file) {
  const resolved = path.resolve(file)
  return MEDIA_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep))
}

function uiVersion() {
  try {
    const files = ['app.js', 'style.css', 'remotion-player.js'].map((name) => path.join(UI_DIR, name))
    return String(Math.round(Math.max(...files.map((file) => fs.statSync(file).mtimeMs))))
  } catch {
    return String(Date.now())
  }
}

function serveIndex(res) {
  const file = path.join(UI_DIR, 'index.html')
  let html = fs.readFileSync(file, 'utf8')
  html = html.replaceAll('__UI_VERSION__', uiVersion())
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(html)
}

function serveFile(req, res, file, { media = false } = {}) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }  if (media && !isAllowed(file)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }
  const stat = fs.statSync(file)
  const ext = path.extname(file).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  const range = req.headers.range
  if (media && range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
      res.end()
      return
    }
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Number(match[2]) : stat.size - 1
    if (start >= stat.size || end >= stat.size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    })
    fs.createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': media ? 'bytes' : 'none',
    'Cache-Control': media ? 'no-cache' : 'no-store',
  })
  fs.createReadStream(file).pipe(res)
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health') {
    const projects = listProjects()
    return sendJson(res, 200, { ok: true, root: ROOT, projects: projects.length })
  }
  if (pathname === '/api/overview' && req.method === 'GET') {
    return sendJson(res, 200, getOverview())
  }
  if (pathname === '/api/voice' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, voice: readVoice() })
  }
  if (pathname === '/api/library' && req.method === 'GET') {
    return sendJson(res, 200, getLibrary())
  }
  if (pathname === '/api/templates' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, templates: getTemplates() })
  }
  if (pathname === '/api/remotion' && req.method === 'GET') {
    const templates = getTemplates().filter((template) => template.remotion)
    const compositions = [...new Set(templates.map((template) => template.remotion.composition))]
    return sendJson(res, 200, {
      ok: true,
      engine: 'remotion',
      player: fileExists('console/ui/remotion-player.js') ? '/ui/remotion-player.js' : null,
      compositions,
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        group: template.group || template.category,
        ...template.remotion,
      })),
    })
  }
  const jobMatch = /^\/api\/jobs\/([^/]+)$/.exec(pathname)
  if (jobMatch && req.method === 'GET') {
    const job = JOBS.get(decodeURIComponent(jobMatch[1]))
    if (!job) return sendJson(res, 404, { ok: false, error: '任务不存在' })
    return sendJson(res, 200, { ok: true, job: publicJob(job) })
  }
  if (pathname === '/api/projects' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const result = createProject({
        root: ROOT,
        id: body.id,
        title: body.title,
        template: body.template,
        spec: body.spec && typeof body.spec === 'object' ? { ...body, ...body.spec } : body,
      })
      return sendJson(res, 200, {
        ok: true,
        project: getProject(result.project.id),
        needsLayoutAdaptation: result.needsLayoutAdaptation,
      })
    } catch (error) {
      if (error instanceof ProjectCreateError) {
        return sendJson(res, error.status || 400, {
          ok: false,
          error: error.message,
          ...(error.questions?.length ? { questions: error.questions } : {}),
        })
      }
      throw error
    }
  }
  if (pathname === '/api/projects' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, projects: listProjects() })
  }

  const match = /^\/api\/projects\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(pathname)
  if (!match) return sendJson(res, 404, { ok: false, error: '接口不存在' })
  const id = decodeURIComponent(match[1])
  const action = match[2]
  const subaction = match[3]
  const project = getProject(id)
  if (!project) return sendJson(res, 404, { ok: false, error: '项目不存在' })
  const projectRoot = path.join(ROOT, 'projects', project.dir)

  const touchProject = (patch = {}) => {
    const projectFile = path.join(projectRoot, 'project.json')
    const raw = readJson(projectFile, null)
    if (!raw) return null
    Object.assign(raw, patch, { updatedAt: new Date().toISOString() })
    fs.writeFileSync(projectFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
    return raw
  }

  if (!action && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, project })
  }

  if (action === 'issues') {
    const issuesFile = path.join(projectRoot, 'issues.json')
    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, issue: getIssues(project) })
    }
    if (req.method === 'POST') {
      const body = await readBody(req)
      const text = String(body.text ?? '').replace(/\r\n/g, '\n')
      if (text.length > 20000) return sendJson(res, 400, { ok: false, error: '问题记录不能超过 20000 字' })
      const updatedAt = new Date().toISOString()
      const issue = { text, updatedAt }
      writeJson(issuesFile, issue)
      return sendJson(res, 200, { ok: true, issue })
    }
  }

  if (action === 'import' && req.method === 'POST') {
    const original = decodeURIComponent(String(req.headers['x-file-name'] || 'asset'))
    const safe = original.split(/[\\/]/).pop().replace(/[<>:"|?*\u0000-\u001f]/g, '_').slice(0, 120) || `asset-${Date.now()}`
    const dir = path.join(projectRoot, 'assets', 'imported')
    fs.mkdirSync(dir, { recursive: true })
    let name = safe
    let index = 1
    while (fs.existsSync(path.join(dir, name))) {
      const ext = path.extname(safe)
      name = `${path.basename(safe, ext)}-${index}${ext}`
      index += 1
    }
    const buffer = await readBinary(req)
    if (!buffer.length) return sendJson(res, 400, { ok: false, error: '文件为空' })
    const file = path.join(dir, name)
    fs.writeFileSync(file, buffer)
    const relative = path.relative(ROOT, file).replace(/\\/g, '/')
    const imports = readJson(path.join(projectRoot, 'imports.json'), [])
    const item = {
      id: crypto.randomUUID(),
      name,
      file: relative,
      bytes: buffer.length,
      mime: String(req.headers['x-file-type'] || 'application/octet-stream'),
      importedAt: new Date().toISOString(),
      analysis: null,
    }
    imports.push(item)
    writeJson(path.join(projectRoot, 'imports.json'), imports)
    touchProject({ imports: imports.map((entry) => entry.file) })
    return sendJson(res, 200, { ok: true, import: { ...item, url: mediaUrl(item.file) } })
  }

  if (action === 'export' && req.method === 'POST') {
    const body = await readBody(req).catch(() => ({}))
    const blocked = projectRenderBlock(project)
    if (blocked) {
      return sendJson(res, 409, { ok: false, error: blocked, layoutAdapted: project.layoutAdapted ?? null, spec: project.spec || null })
    }
    if (project.kind === 'video-frame' && fs.existsSync(path.join(projectRoot, 'frame.json'))) {
      const args = ['bin/frame-video.mjs', '--project', `projects/${project.dir}`]
      try {
        const job = startJob('frame', project, args)
        return sendJson(res, 200, { ok: true, job: publicJob(job) })
      } catch (error) {
        return sendJson(res, error.status || 500, { ok: false, error: error.message })
      }
    }
    if (project.kind === 'video-remix' && fs.existsSync(path.join(projectRoot, 'edl.json'))) {
      const args = ['bin/assemble.mjs', '--edl', `projects/${project.dir}/edl.json`, '--out', `out/${project.dir}/film.mp4`]
      try {
        const job = startJob('remix', project, args)
        return sendJson(res, 200, { ok: true, job: publicJob(job) })
      } catch (error) {
        return sendJson(res, error.status || 500, { ok: false, error: error.message })
      }
    }
    const args = ['bin/produce.mjs', '--project', `projects/${project.dir}`]
    if (body.remixOnly) {
      args.push('--skip-voice', '--skip-render')
    } else {
      if (!body.regenerateVoice) args.push('--skip-voice')
      if (body.skipRender) args.push('--skip-render')
    }
    try {
      const job = startJob('export', project, args)
      return sendJson(res, 200, { ok: true, job: publicJob(job) })
    } catch (error) {
      return sendJson(res, error.status || 500, { ok: false, error: error.message })
    }
  }

  if (action === 'edit' && req.method === 'POST') {
    const body = await readBody(req)
    const current = getEdit(project)
    const clamp = (value, fallback = 1) => Math.max(0, Math.min(2, Number(value ?? fallback)))
    const next = {
      ...current,
      version: 1,
      updatedAt: new Date().toISOString(),
      music: {
        ...current.music,
        ...(body.music || {}),
        volume: clamp(body.music?.volume ?? current.music?.volume ?? 1),
        muted: Boolean(body.music?.muted ?? current.music?.muted),
        start: Math.max(0, Number(body.music?.start ?? current.music?.start ?? 0)),
      },
      voice: {
        ...current.voice,
        ...(body.voice || {}),
        volume: clamp(body.voice?.volume ?? current.voice?.volume ?? 1),
        muted: Boolean(body.voice?.muted ?? current.voice?.muted),
      },
      sfx: {
        ...current.sfx,
        ...(body.sfx || {}),
        volume: clamp(body.sfx?.volume ?? current.sfx?.volume ?? 1),
        muted: Boolean(body.sfx?.muted ?? current.sfx?.muted),
      },
      notes: String(body.notes ?? current.notes ?? ''),
    }
    writeJson(path.join(projectRoot, 'edit.json'), next)
    touchProject({ editAt: next.updatedAt })
    return sendJson(res, 200, { ok: true, edit: next })
  }

  if (action === 'script' && req.method === 'POST') {
    const body = await readBody(req)
    const scriptFile = path.join(projectRoot, 'script.json')
    const script = readJson(scriptFile, null)
    if (!script) return sendJson(res, 404, { ok: false, error: '缺少 script.json' })
    if (Array.isArray(body.lines)) {
      const byId = new Map(body.lines.map((line) => [String(line.id), String(line.text ?? '')]))
      script.lines = (script.lines || []).map((line) => byId.has(String(line.id)) ? { ...line, text: byId.get(String(line.id)) } : line)
    }
    for (const key of ['title', 'subtitle', 'summary', 'instruct']) {
      if (body[key] !== undefined) script[key] = String(body[key])
    }
    if (Array.isArray(body.tags)) script.tags = body.tags.map(String)
    fs.writeFileSync(scriptFile, JSON.stringify(script, null, 2) + '\n', 'utf8')
    touchProject({
      title: script.title,
      subtitle: script.subtitle,
      summary: script.summary,
      tags: script.tags,
    })
    return sendJson(res, 200, { ok: true, script })
  }

  if (action === 'sfx' && req.method === 'POST') {
    const body = await readBody(req)
    const kind = String(body.kind || 'transition')
    if (!['transition', 'impact', 'tick'].includes(kind)) return sendJson(res, 400, { ok: false, error: '只能设置转场 / 冲击 / 点击' })
    const catalog = readJson(path.join(ROOT, 'library', 'sfx', 'catalog.json'), { tracks: [] })
    const track = (catalog.tracks || []).find((item) => item.id === body.trackId)
    if (!track) return sendJson(res, 404, { ok: false, error: '音效不存在' })
    const source = path.join(ROOT, track.path || `library/sfx/kenney/${track.file}`)
    if (!fs.existsSync(source)) return sendJson(res, 404, { ok: false, error: '音效文件不存在' })
    const sfxDir = path.join(ROOT, 'out', project.id, 'sfx')
    fs.mkdirSync(sfxDir, { recursive: true })
    const ext = path.extname(source).toLowerCase() || '.ogg'
    for (const oldExt of ['.ogg', '.wav', '.mp3', '.m4a']) {
      const stale = path.join(sfxDir, `${kind}${oldExt}`)
      if (stale !== path.join(sfxDir, `${kind}${ext}`)) fs.rmSync(stale, { force: true })
    }
    const output = path.join(sfxDir, `${kind}${ext}`)
    fs.copyFileSync(source, output)
    const relative = path.relative(ROOT, output).replace(/\\/g, '/')
    const projectFile = path.join(projectRoot, 'project.json')
    const raw = readJson(projectFile, null)
    if (raw) {
      raw.sfx = raw.sfx || {}
      raw.sfx[kind] = {
        id: track.id,
        title: track.title,
        titleZh: track.titleZh,
        file: relative,
        sourceFile: track.path,
        category: track.category,
        categoryZh: track.categoryZh,
        tags: track.tags,
        tagsZh: track.tagsZh,
        duration: track.duration,
        license: track.license,
        source: track.source,
        attribution: track.attribution,
        selectedAt: new Date().toISOString(),
      }
      raw.updatedAt = new Date().toISOString()
      fs.writeFileSync(projectFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
    }
    return sendJson(res, 200, { ok: true, sfx: { kind, track, file: relative, url: mediaUrl(relative) } })
  }

  if (action === 'music' && req.method === 'POST') {
    const body = await readBody(req)
    const trackId = String(body.trackId || '').trim()
    if (!trackId) return sendJson(res, 400, { ok: false, error: '缺少曲目 id' })
    const args = ['bin/music.mjs', '--project', `projects/${project.dir}`, '--id', trackId]
    if (body.remote) args.push('--remote')
    try {
      const job = startJob('music', project, args)
      return sendJson(res, 200, { ok: true, job: publicJob(job) })
    } catch (error) {
      return sendJson(res, error.status || 500, { ok: false, error: error.message })
    }
  }

  if (action === 'brief' && req.method === 'POST') {
    const body = await readBody(req)
    const file = path.join(projectRoot, 'brief.json')
    const current = readJson(file, {})
    const next = {
      ...current,
      ...body,
      feasibility: { ...(current.feasibility || {}), ...(body.feasibility || {}) },
      updatedAt: new Date().toISOString(),
    }
    writeJson(file, next)
    touchProject({ briefAt: next.updatedAt })
    return sendJson(res, 200, { ok: true, brief: next })
  }

  return sendJson(res, 405, { ok: false, error: '方法不支持' })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const pathname = decodeURIComponent(url.pathname)

    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname)

    if (pathname === '/' || pathname === '/index.html') {
      return serveIndex(res)
    }
    if (pathname.startsWith('/ui/')) {
      const file = path.join(UI_DIR, pathname.slice('/ui/'.length))
      if (!file.startsWith(UI_DIR + path.sep)) {
        res.writeHead(403)
        return res.end('Forbidden')
      }
      return serveFile(req, res, file)
    }
    if (pathname.startsWith('/media/')) {
      const relative = pathname.slice('/media/'.length)
      const file = path.resolve(ROOT, relative)
      return serveFile(req, res, file, { media: true })
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  } catch (error) {
    console.error(error)
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: error.message })
    else res.end()
  }
})

try {
  const { buildPlayer, isPlayerStale } = await import('../bin/remotion-build.mjs')
  if (isPlayerStale()) {
    const built = await buildPlayer()
    console.log(`[nutcut] remotion player rebuilt  ${(built.bytes / 1024).toFixed(0)} KB · ${built.ms}ms`)
  }
} catch (error) {
  console.warn(`[nutcut] remotion player 未打包：${error.message}`)
}

server.listen(PORT, HOST, () => {
  console.log(`[nutcut] console  http://${HOST}:${PORT}`)
  console.log(`[nutcut] root     ${ROOT}`)
})
