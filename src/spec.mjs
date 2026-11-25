/**
 * 视频规格（spec）是项目级决策，不是模板属性。
 *
 * 模板只定义风格、配色和动效；横屏/竖屏、分辨率、帧率、时长在每次做视频前确认。
 * 缺少规格时，Agent 必须先问用户，不允许默认 16:9 或 9:16。
 */

export const ORIENTATIONS = {
  landscape: { label: '横屏', aspect: '16:9', width: 1920, height: 1080 },
  portrait: { label: '竖屏', aspect: '9:16', width: 1080, height: 1920 },
  square: { label: '方形', aspect: '1:1', width: 1080, height: 1080 },
}

export const QUALITIES = {
  '720p': { landscape: [1280, 720], portrait: [720, 1280], square: [720, 720] },
  '1080p': { landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080] },
  '4k': { landscape: [3840, 2160], portrait: [2160, 3840], square: [2160, 2160] },
}

export const FPS_VALUES = [24, 25, 30, 50, 60]
export const AUDIO_MODES = ['source', 'clone', 'none', 'undecided']

export function orientationOf(width, height) {
  if (!width || !height) return null
  if (Math.abs(width / height - 1) < 0.02) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

export function parseSize(value) {
  const match = /^(\d{2,5})\s*[x×*]\s*(\d{2,5})$/i.exec(String(value || '').trim())
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}

export function expectedSpecQuestions() {
  return [
    '这条视频是横屏 16:9、竖屏 9:16，还是方形 1:1？',
    '成片尺寸是多少？1080p、720p、4K，还是自定义宽高？',
    '帧率要 24 / 25 / 30 / 50 / 60 里的哪个？',
    '目标时长多少秒？主要发在哪个平台？',
    '声音用原声、克隆配音，还是无人声？',
  ]
}

/**
 * 归一化并校验规格。
 * input 可以来自 CLI、API 或 AI 填的 project.spec。
 */
export function normalizeSpec(input = {}) {
  const raw = input || {}
  const size = parseSize(raw.size || (raw.width && raw.height ? `${raw.width}x${raw.height}` : ''))
  const orientationAliases = {
    vertical: 'portrait',
    portrait: 'portrait',
    '9:16': 'portrait',
    horizontal: 'landscape',
    landscape: 'landscape',
    '16:9': 'landscape',
    square: 'square',
    '1:1': 'square',
  }
  const rawOrientation = String(raw.orientation || (size ? orientationOf(size.width, size.height) : '')).toLowerCase()
  const orientation = orientationAliases[rawOrientation] || rawOrientation
  if (!ORIENTATIONS[orientation]) {
    return {
      ok: false,
      error: '缺少视频规格：先确认横屏/竖屏/方形',
      questions: expectedSpecQuestions(),
    }
  }

  let width = Number(size?.width || raw.width || 0)
  let height = Number(size?.height || raw.height || 0)
  const qualityInput = String(raw.quality || '1080p').toLowerCase()
  if (!size && raw.quality && !QUALITIES[qualityInput]) {
    return { ok: false, error: `分辨率档位不支持：${raw.quality}（用 720p / 1080p / 4k，或 --size 直接给宽高）`, questions: expectedSpecQuestions() }
  }
  if (!width || !height) {
    const quality = QUALITIES[qualityInput] ? qualityInput : '1080p'
    ;[width, height] = QUALITIES[quality][orientation]
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 240) {
    return { ok: false, error: '视频宽高不合法，至少 240×240', questions: expectedSpecQuestions() }
  }
  if (width > 7680 || height > 7680) {
    return { ok: false, error: '视频宽高过大，最大 7680', questions: expectedSpecQuestions() }
  }
  width = Math.round(width / 2) * 2
  height = Math.round(height / 2) * 2

  const fps = Number(raw.fps || 30)
  if (!Number.isFinite(fps) || fps < 10 || fps > 120) {
    return { ok: false, error: `帧率不合法：${raw.fps}`, questions: expectedSpecQuestions() }
  }

  const duration = Number(raw.duration || 0)
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      ok: false,
      error: '缺少视频规格：需要确认目标时长（秒）',
      questions: expectedSpecQuestions(),
    }
  }
  if (duration > 3600) {
    return { ok: false, error: '目标时长过长，最大 3600 秒', questions: expectedSpecQuestions() }
  }

  const audio = AUDIO_MODES.includes(raw.audio) ? raw.audio : 'undecided'
  const orientationInfo = ORIENTATIONS[orientation]
  const actualOrientation = orientationOf(width, height)
  if (actualOrientation !== orientation) {
    return {
      ok: false,
      error: `尺寸 ${width}×${height} 与画幅 ${orientationInfo.label} 不一致`,
      questions: expectedSpecQuestions(),
    }
  }

  return {
    ok: true,
    spec: {
      orientation,
      orientationLabel: orientationInfo.label,
      aspect: orientationInfo.aspect,
      width,
      height,
      fps: Math.round(fps),
      duration: Math.round(duration * 1000) / 1000,
      quality: QUALITIES[qualityInput] ? qualityInput : null,
      platform: String(raw.platform || '').trim(),
      audio,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
    },
  }
}

export function specLabel(spec) {
  if (!spec) return '未确认'
  const label = ORIENTATIONS[spec.orientation]?.label || spec.orientation || ''
  return `${label} ${spec.width}×${spec.height} · ${spec.fps}fps · ${spec.duration} 秒`
}

/**
 * 渲染前的统一拦截。
 * 只拦明确缺规格或明确未适配的项目，避免老项目没有 layoutAdapted 字段时被误伤。
 */
export function projectRenderBlock(project) {
  if (!project?.spec?.confirmed) {
    return '缺少已确认的视频规格：先问用户横屏/竖屏/方形、尺寸、帧率、时长，写入 project.json 的 spec 再继续'
  }
  if (project.layoutAdapted === false) {
    return '模板版式还没有按目标规格适配：先改项目 src/index.html，再跑 node bin/adapt-layout.mjs --project projects/<id> --confirm'
  }
  return null
}

