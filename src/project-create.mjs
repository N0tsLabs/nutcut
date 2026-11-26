/**
 * 项目创建的唯一实现。
 * CLI（bin/new-project.mjs）和中控台 API 都走这里，避免两份逻辑漂移。
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSpec, orientationOf, expectedSpecQuestions } from './spec.mjs'

export class ProjectCreateError extends Error {
  constructor(message, { status = 400, questions = [] } = {}) {
    super(message)
    this.name = 'ProjectCreateError'
    this.status = status
    this.questions = questions
  }
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function demoLines(title) {
  return [
    `开场：${title}`,
    '第二句：为什么这件事值得看',
    '第三句：核心信息',
    '第四句：一个具体例子',
    '第五句：结论',
    '结尾：回扣主题',
  ]
}

/**
 * @param {{
 *   root?: string,
 *   id: string,
 *   title?: string,
 *   template: string,
 *   spec?: object,
 *   writeReadme?: boolean,
 * }} options
 */
export function createProject(options) {
  const root = path.resolve(options.root || process.cwd())
  const id = String(options.id || '').trim().toLowerCase()
  const title = String(options.title || '').trim() || id
  const templateId = String(options.template || '').trim()

  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) {
    throw new ProjectCreateError('项目 id 只能用小写字母、数字和短横线')
  }
  if (!title) throw new ProjectCreateError('缺少项目标题')
  if (!templateId) throw new ProjectCreateError('缺少模板 id')

  const normalized = normalizeSpec(options.spec || {})
  if (!normalized.ok) {
    throw new ProjectCreateError(normalized.error, { questions: normalized.questions || expectedSpecQuestions() })
  }
  const spec = normalized.spec

  const projectDir = path.join(root, 'projects', id)
  if (fs.existsSync(projectDir)) {
    throw new ProjectCreateError('项目已存在', { status: 409 })
  }

  const templateDir = path.join(root, 'templates', templateId)
  const templateMeta = readJson(path.join(templateDir, 'template.json'), null)
  if (!templateMeta) throw new ProjectCreateError('模板不存在')
  if (!fs.existsSync(path.join(templateDir, 'src', 'index.html'))) {
    throw new ProjectCreateError('模板缺少 src/index.html')
  }

  const templateMotion = readJson(path.join(templateDir, 'motion.json'), {})
  const nativeWidth = Number(templateMotion.output?.width || 1920)
  const nativeHeight = Number(templateMotion.output?.height || 1080)
  const nativeOrientation = orientationOf(nativeWidth, nativeHeight)
  const needsLayoutAdaptation = nativeWidth !== spec.width || nativeHeight !== spec.height

  fs.mkdirSync(projectDir, { recursive: true })
  for (const entry of ['src', 'presets']) {
    const from = path.join(templateDir, entry)
    if (fs.existsSync(from)) fs.cpSync(from, path.join(projectDir, entry), { recursive: true })
  }
  for (const file of ['motion.json', 'params.schema.json', 'LICENSE']) {
    const from = path.join(templateDir, file)
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(projectDir, file))
  }

  const motion = readJson(path.join(projectDir, 'motion.json'), null)
  if (motion) {
    motion.id = id
    motion.name = `${title} · ${templateMeta.name}`
    motion.description = templateMeta.description || ''
    motion.tags = [...new Set([...(motion.tags || []), templateId, ...(templateMeta.tags || [])])]
    motion.output = {
      ...(motion.output || {}),
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      duration: spec.duration,
    }
    writeJson(path.join(projectDir, 'motion.json'), motion)
  }

  const lines = demoLines(title)
  const script = {
    id,
    title,
    subtitle: `${templateMeta.category || '短片'} · ${spec.orientationLabel} · ${spec.duration} 秒`,
    summary: '',
    tags: [templateId, ...(templateMeta.tags || []).slice(0, 3)],
    template: templateId,
    spec,
    voice: spec.audio === 'none' ? '' : 'me',
    instruct: '保持自然语速，像跟朋友说话，克制、松弛，不要播音腔。',
    intro: 1.5,
    gap: 0.5,
    outro: 3,
    ducking: { threshold: 0.01, ratio: 4, attack: 120, release: 800 },
    lines: lines.map((text, index) => ({ id: String(index + 1).padStart(2, '0'), scene: `s${index + 1}`, text })),
  }
  writeJson(path.join(projectDir, 'script.json'), script)

  const brief = {
    topic: title,
    audience: '',
    angle: '',
    spec,
    format: `${spec.orientationLabel} ${spec.width}×${spec.height} · ${spec.duration} 秒`,
    template: templateId,
    references: [],
    feasibility: { score: null, risks: [], decision: 'pending', notes: '' },
    imagePlan: [],
    createdAt: new Date().toISOString(),
  }
  writeJson(path.join(projectDir, 'brief.json'), brief)

  const project = {
    id,
    title,
    subtitle: script.subtitle,
    summary: '',
    status: 'idea',
    stage: 'idea',
    duration: spec.duration,
    tags: script.tags,
    voiceProfile: spec.audio === 'none' ? 'none' : 'me',
    template: templateId,
    renderEngine: 'html',
    previewEngine: templateMeta.remotion?.composition ? 'remotion' : 'html',
    spec,
    templateNative: { width: nativeWidth, height: nativeHeight, orientation: nativeOrientation },
    layoutAdapted: !needsLayoutAdaptation,
    approvals: {
      spec: true,
      brief: false,
      script: false,
      keyframes: false,
      updatedAt: new Date().toISOString(),
      confirmedBy: null,
      history: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: { template: `projects/${id}/src/index.html` },
    pipeline: [
      { id: 'spec', label: '规格', status: 'done' },
      { id: 'idea', label: '想法', status: 'doing' },
      { id: 'script', label: '文案', status: 'todo' },
      { id: 'voice', label: '声音', status: 'todo' },
      { id: 'render', label: '画面', status: 'todo' },
      { id: 'mix', label: '混音', status: 'todo' },
      { id: 'review', label: '待确认', status: 'todo' },
    ],
    script: `projects/${id}/script.json`,
  }
  writeJson(path.join(projectDir, 'project.json'), project)

  writeJson(path.join(projectDir, 'issues.json'), { text: '', updatedAt: null })
  writeJson(path.join(projectDir, 'imports.json'), [])
  writeJson(path.join(projectDir, 'edit.json'), {
    version: 1,
    music: { volume: 1, muted: false, start: 0 },
    voice: { volume: 1, muted: false },
    sfx: { volume: 1, muted: false },
    notes: '',
  })

  if (options.writeReadme !== false) {
    const adaptation = needsLayoutAdaptation
      ? `模板原生画布是 ${nativeWidth}×${nativeHeight}，目标是 ${spec.width}×${spec.height}；渲染前必须改编 src/index.html 的版式，然后运行 node bin/adapt-layout.mjs --project projects/${id} --confirm。`
      : '模板原生画布与目标规格一致，可以直接改编文案。'
    fs.writeFileSync(
      path.join(projectDir, 'README.md'),
      `# ${title}\n\n模板：${templateMeta.name}（${templateMeta.category}）\n规格：${spec.orientationLabel} ${spec.width}×${spec.height} · ${spec.fps}fps · ${spec.duration} 秒${spec.platform ? ` · ${spec.platform}` : ''}\n\n${adaptation}\n\n下一步：先补 brief.json 的受众、角度和可行性，再写文案。\n`,
      'utf8',
    )
  }

  return {
    project,
    templateMeta,
    spec,
    needsLayoutAdaptation,
  }
}
