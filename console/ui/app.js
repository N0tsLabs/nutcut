const state = {
  overview: null,
  projects: [],
  library: null,
  templates: [],
  view: 'dashboard',
  filter: 'all',
  search: '',
  templateFeature: 'all',
  templateGroup: 'all',
  current: null,
  projectTab: 'overview',
  assetTab: 'music',
  assetFilter: 'all',
  assetCategory: 'all',
  assetQuery: '',
  assetLimit: 48,
  galleries: {},
  viewer: { gallery: null, index: 0 },
  job: null,
  jobTimer: null,
  issueTimer: null,
  issueFlush: null,
  preview: { template: null, time: 0, playing: true, raf: null, last: 0, ready: false, lastFrame: null },
}

const STATUS_ZH = { done: '已完成', review: '待确认', template: '模板', idea: '想法', script: '文案', voice: '声音', render: '画面', mix: '混音', wip: '制作中' }
const STAGE_ZH = { idea: '想法', script: '文案', voice: '声音', render: '画面', mix: '混音', review: '待确认' }
const CATEGORY_ZH = { transition: '转场', impact: '冲击', tick: '点击', pop: '弹出', notify: '提示', typing: '打字', glitch: '故障', ui: '界面', foley: '拟音', ambience: '环境' }
const MUSIC_CATEGORY_ZH = { cinematic: '电影感', world: '世界音乐', lofi: 'Lo-Fi', explainer: '说明片', dreamy: '梦幻', intro: '开场', activities: '工作日常' }
const PREVIEW_SEGMENT_SECONDS = 2.5
const PREVIEW_TOTAL = 10
const PREVIEW_SEGMENTS = [0, 3.75, 8.75, 13.75]
const ASSET_LABELS = { video: '成片视频', poster: '封面图', mix: '混音文件', silent: '无声视频', template: '画面模板', timings: '时间线数据', vo: '逐句声音', source: '原始素材', analysis: '视频分析', edl: '剪辑 EDL', audio: '成片音轨', frame: '画中画参数', layer: '模板层', style: '风格决策' }

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
function formatNumber(value) { return Number(value || 0).toLocaleString('zh-CN') }
function formatDuration(seconds) {
  const value = Number(seconds || 0)
  return value > 0 ? `${value.toFixed(2)} 秒` : '—'
}
function timecode(seconds) {
  const value = Math.max(0, Number(seconds || 0))
  const minutes = Math.floor(value / 60)
  return `${String(minutes).padStart(2, '0')}:${(value % 60).toFixed(1).padStart(4, '0')}`
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function shortTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function statusLabel(status) { return STATUS_ZH[status] || '制作中' }
function statusClass(status) { return ['done', 'review', 'template'].includes(status) ? status : 'review' }
function isFilm(project) { return project.status !== 'template' }
function mediaPath(file) { return `/media/${String(file || '').split('/').map(encodeURIComponent).join('/')}` }
function prettyCategory(id) {
  return MUSIC_CATEGORY_ZH[id] || String(id || '').split(/[-_]/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
function sfxTitle(track) { return track?.titleZh || track?.title || '音效' }
function clipTitle(project, line) {
  const text = String(line?.text || '').trim()
  return text.length > 22 ? `${text.slice(0, 22)}…` : text || `第 ${line?.id || ''} 句`
}

function showToast(message) {
  const toast = $('#toast')
  toast.textContent = message
  toast.classList.add('show')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400)
}

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `请求失败：${response.status}`)
    error.data = data
    throw error
  }
  return data
}

async function loadAll() {
  try {
    const [overview, projects, library, templates] = await Promise.all([
      request('/api/overview'), request('/api/projects'), request('/api/library'), request('/api/templates'),
    ])
    state.overview = overview
    state.projects = projects.projects || []
    state.library = library
    state.templates = templates.templates || []
    buildGalleries()
    renderAll()
  } catch (error) {
    showToast(`读取失败：${error.message}`)
  }
}

function buildGalleries() {
  const all = []
  const galleries = { all }
  for (const project of state.projects) {
    const list = []
    for (const image of project.images || []) {
      const item = { url: mediaPath(image), caption: `${project.title} / ${String(image).split('/').pop()}`, file: image }
      list.push(item); all.push(item)
    }
    if (list.length) galleries[`project:${project.id}`] = list
  }
  state.galleries = galleries
}

function renderAll() {
  if (!state.overview) return
  $('#side-port').textContent = `127.0.0.1:${state.overview.system.port}`
  $('#side-uptime').textContent = `已运行 ${Math.round(state.overview.system.uptime)} 秒 · Node ${state.overview.system.node}`
  renderKPIs()
  renderVoiceCard()
  renderPipeline()
  renderActivity()
  renderSpotlight()
  renderProjectTable($('#project-table'), filteredProjects())
  renderProjectTable($('#project-table-full'), filteredProjects())
  renderTemplates()
  renderVoiceView()
  renderAssetsView()
  renderSystemView()
  if (state.current) renderProjectPage()
}

function filteredProjects() {
  const search = state.search.trim().toLowerCase()
  return state.projects.filter((project) => {
    if (state.filter === 'film' && !isFilm(project)) return false
    if (state.filter === 'template' && project.status !== 'template') return false
    if (!search) return true
    const haystack = [project.title, project.subtitle, project.summary, statusLabel(project.status), ...(project.tags || [])].join(' ').toLowerCase()
    return haystack.includes(search)
  })
}

function renderKPIs() {
  const { stats, storage } = state.overview
  const items = [
    { label: '项目', value: stats.projects, sub: `${stats.films} 个成片 / ${stats.templates} 个模板` },
    { label: '总时长', value: `${Number(stats.totalDuration || 0).toFixed(1)} 秒`, sub: '所有成片' },
    { label: '总帧数', value: formatNumber(stats.totalFrames), sub: '已渲染画面' },
    { label: '成片大小', value: formatBytes(stats.totalBytes), sub: `输出目录 ${formatBytes(storage.out)}` },
    { label: '问题记录', value: stats.issuesOpen || 0, sub: '有记录的项目' },
    { label: '声音档案', value: state.overview.voice?.id?.toUpperCase() || '—', sub: '本地声音' },
  ]
  $('#kpis').innerHTML = items.map((item) => `
    <article class="kpi"><div class="kpi-label">${item.label}</div><div class="kpi-value">${escapeHtml(item.value)}</div><div class="kpi-sub">${escapeHtml(item.sub)}</div></article>`).join('')
}

function waveBars(count = 36) {
  return Array.from({ length: count }, (_, i) => {
    const h = 8 + Math.abs(Math.sin(i * 1.73) * 32) + Math.abs(Math.cos(i * .47) * 10)
    return `<i style="height:${Math.min(44, h)}px"></i>`
  }).join('')
}

function renderVoiceCard() {
  const voice = state.overview.voice
  if (!voice) {
    $('#voice-card').innerHTML = `<div class="panel-head"><div><span class="panel-kicker">声音</span><h2>未配置</h2></div></div>`
    return
  }
  $('#voice-card').innerHTML = `
    <div class="panel-head"><div><span class="panel-kicker">声音</span><h2>声音档案</h2></div><span class="verified">已验证</span></div>
    <div class="voice-head"><div><div class="voice-id">${escapeHtml(voice.id?.toUpperCase())}</div><div class="voice-sub">MiniMax 声音克隆</div></div></div>
    <div class="wave-bars">${waveBars()}</div>
    <div class="voice-meta">
      <div class="meta-line"><span>引擎</span><b>MiniMax</b></div>
      <div class="meta-line"><span>模型</span><b>${escapeHtml((voice.minimax?.model || 'speech-2.8-turbo').replace('speech-', ''))}</b></div>
      <div class="meta-line"><span>时长</span><b>${formatDuration(voice.duration)}</b></div>
      <div class="meta-line"><span>采样率</span><b>${Number(voice.sampleRate || 0) / 1000} 千赫</b></div>
      <div class="meta-line"><span>裁切</span><b>${(voice.trimSeconds || []).join('–')} 秒</b></div>
      <div class="meta-line"><span>校验码</span><b>${escapeHtml(voice.sha256Short || '—')}</b></div>
    </div>
    ${voice.referenceUrl ? `<audio controls preload="metadata" src="${escapeHtml(voice.referenceUrl)}"></audio>` : ''}
    <div class="pipe-line"></div>
    <div class="meta-line"><span>来源</span><b>${escapeHtml(voice.source || '—')}</b></div>`
}

function renderPipeline() {
  const latest = state.projects.find((project) => project.status !== 'template') || state.projects[0]
  const pipeline = latest?.pipeline?.length ? latest.pipeline : Object.keys(STAGE_ZH).map((id) => ({ id, label: STAGE_ZH[id], status: 'todo' }))
  const done = pipeline.filter((step) => step.status === 'done').length
  $('#pipeline-card').innerHTML = `
    <div class="panel-head"><div><span class="panel-kicker">流程</span><h2>制作流程</h2></div><span class="muted">${done}/${pipeline.length}</span></div>
    <div class="pipe-list">${pipeline.map((step) => `<div class="pipe-step ${escapeHtml(step.status || '')}"><i></i>${escapeHtml(STAGE_ZH[step.id] || step.label)}</div>`).join('')}</div>
    <div class="pipe-line"></div>
    <div class="pipe-foot"><span>${latest ? escapeHtml(latest.title) : '暂无项目'}</span><span>${latest ? formatDuration(latest.duration) : '—'}</span></div>`
}

function renderActivity() {
  const activity = state.overview.activity || []
  $('#activity-card').innerHTML = `
    <div class="panel-head"><div><span class="panel-kicker">动态</span><h2>最近动态</h2></div><span class="muted">${activity.length}</span></div>
    <div class="activity">${activity.length ? activity.map((item) => `
      <div class="activity-item">
        <time>${shortTime(item.at)}</time>
        <div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div>
      </div>`).join('') : '<div class="empty">暂无动态</div>'}</div>`
}

function renderSpotlight() {
  const project = state.projects.find((item) => item.status !== 'template') || state.projects[0]
  if (!project) { $('#spotlight').innerHTML = ''; return }
  const scenes = project.scenes?.length ? project.scenes : Array.from({ length: 6 }, (_, i) => ({ scene: `s${i + 1}`, start: i * 5, end: (i + 1) * 5 }))
  const total = Number(project.duration || scenes[scenes.length - 1]?.end || 1)
  const poster = project.assets?.poster ? `<img src="${escapeHtml(project.assets.poster)}" alt="" loading="lazy" />` : `<div class="empty">暂无封面</div>`
  const blocks = scenes.map((scene) => {
    const width = Math.max(4, (Number(scene.end) - Number(scene.start)) / total * 100)
    return `<div class="scene-block done" style="width:${width}%" title="${escapeHtml(scene.scene)} · ${Number(scene.end - scene.start).toFixed(2)} 秒"><span>${escapeHtml(scene.line || scene.scene).replace(/^s/, '')}</span></div>`
  }).join('')
  const tech = project.tech || {}
  $('#spotlight').innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><span class="panel-kicker">当前成片</span><h2>当前成片</h2></div><span class="muted">${statusLabel(project.status)}</span></div>
      <div class="spotlight-poster">${poster}</div>
      <p class="spotlight-summary">${escapeHtml(project.summary || project.subtitle || '')}</p>
    </section>
    <section class="panel">
      <div class="panel-head"><div><span class="panel-kicker">场景</span><h2>${escapeHtml(project.title)}</h2></div><span class="muted">${scenes.length} 个场景</span></div>
      <div class="scene-map">${blocks}</div>
      <div class="scene-legend"><span>00:00</span><span>${formatDuration(total)}</span></div>
      <div class="spotlight-meta">
        <div class="meta-line"><span>帧数</span><b>${formatNumber(tech.frames || project.frameCount)}</b></div>
        <div class="meta-line"><span>帧率</span><b>${escapeHtml(tech.fps || 30)}</b></div>
        <div class="meta-line"><span>声音</span><b>${escapeHtml((project.voiceProfile || '—').toUpperCase())}</b></div>
        <div class="meta-line"><span>句数</span><b>${project.voiceLines?.length || '—'}</b></div>
        <div class="meta-line"><span>响度</span><b>${escapeHtml(tech.loudness || '—')}</b></div>
        <div class="meta-line"><span>图片</span><b>${project.images?.length || 0}</b></div>
        <div class="meta-line"><span>大小</span><b>${formatBytes(project.bytes)}</b></div>
      </div>
    </section>
    <section class="panel spotlight-assets-panel">
      <div class="panel-head"><div><span class="panel-kicker">交付物</span><h2>交付物</h2></div></div>
      <div class="spotlight-assets">
        <div class="spotlight-asset"><span>视频</span><b>H.264 · ${escapeHtml(tech.width || 1920)}×${escapeHtml(tech.height || 1080)}</b></div>
        <div class="spotlight-asset"><span>音频</span><b>AAC · -16 LUFS</b></div>
        <div class="spotlight-asset"><span>声音</span><b>${escapeHtml((project.voiceProfile || 'ME').toUpperCase())} · ${project.voiceLines?.length || 0} 句</b></div>
        <div class="spotlight-asset"><span>渲染</span><b>Puppeteer + FFmpeg</b></div>
        <div class="spotlight-asset"><span>音乐</span><b>${escapeHtml(project.music?.titleZh || project.music?.title || '合成氛围')}</b></div>
        <div class="spotlight-asset"><span>音效</span><b>${project.sfx ? 'CC0 音效' : '合成音效'}</b></div>
        <div class="spotlight-asset"><span>技术</span><b>HTML + Canvas</b></div>
        <div class="spotlight-asset"><span>图片</span><b>${project.images?.length || 0} 张</b></div>
        <div class="spotlight-asset"><span>总计</span><b>${formatBytes(project.bytes)}</b></div>
      </div>
      <button class="btn" data-open="${escapeHtml(project.id)}" style="width:100%;margin-top:14px">打开项目 →</button>
    </section>`
}

function renderProjectTable(container, projects) {
  if (!container) return
  if (!projects.length) { container.innerHTML = '<div class="empty">没有符合条件的项目</div>'; return }
  container.innerHTML = `
    <div class="table">
      <div class="table-head"><span>状态</span><span>项目</span><span>时长</span><span>帧数</span><span>声音</span><span>更新</span><span>记录</span><span></span></div>
      ${projects.map((project) => `
        <div class="project-row" data-id="${escapeHtml(project.id)}">
          <span class="status ${statusClass(project.status)}"><i></i>${statusLabel(project.status)}</span>
          <div class="project-name"><b>${escapeHtml(project.title)}</b><small>${escapeHtml(project.subtitle || project.summary || '')}</small><div class="project-tags">${(project.tags || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div></div>
          <span class="cell-mono">${formatDuration(project.duration)}</span>
          <span class="cell-mono dim">${project.frameCount ? formatNumber(project.frameCount) : '—'}</span>
          <span class="cell-mono dim">${escapeHtml((project.voiceProfile || '—').toUpperCase())}</span>
          <span class="cell-mono dim">${formatDate(project.updatedAt)}</span>
          <span class="cell-mono ${project.issueCount ? '' : 'dim'}">${project.issueCount ? '有' : '—'}</span>
          <span class="row-arrow">→</span>
        </div>`).join('')}
    </div>`
}

function switchView(view) {
  if (state.current) closeProject(false)
  state.view = view
  const titles = { dashboard: '总览', projects: '项目', templates: '模板', voice: '声音', assets: '素材', system: '系统' }
  $('#view-title').textContent = titles[view] || '总览'
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view))
  $$('.view').forEach((element) => { element.hidden = element.id !== `view-${view}` })
  document.body.classList.remove('project-open')
  history.replaceState(null, '', view === 'dashboard' ? '#/' : `#/${view}`)
  if (view === 'dashboard') refreshLiveData()
  else if (view === 'projects') refreshProjectList()
}

let lastLiveRefresh = 0
async function refreshProjectList() {
  try {
    const data = await request('/api/projects')
    state.projects = data.projects || []
    buildGalleries()
    renderProjectTable($('#project-table'), filteredProjects())
    renderProjectTable($('#project-table-full'), filteredProjects())
  } catch {}
}
async function refreshLiveData() {
  const now = Date.now()
  if (now - lastLiveRefresh < 2500) return
  lastLiveRefresh = now
  try {
    const [overview, projects] = await Promise.all([request('/api/overview'), request('/api/projects')])
    state.overview = overview
    state.projects = projects.projects || []
    buildGalleries()
    renderKPIs()
    renderVoiceCard()
    renderPipeline()
    renderActivity()
    renderSpotlight()
    renderProjectTable($('#project-table'), filteredProjects())
    renderProjectTable($('#project-table-full'), filteredProjects())
    renderSystemView()
  } catch {}
}
window.addEventListener('focus', () => {
  if (!state.current && (state.view === 'dashboard' || state.view === 'projects')) refreshLiveData()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !state.current && (state.view === 'dashboard' || state.view === 'projects')) refreshLiveData()
})
setInterval(() => {
  if (document.visibilityState !== 'visible' || state.current) return
  if (state.view === 'projects') refreshProjectList()
  else if (state.view === 'dashboard') refreshLiveData()
}, 15000)

function renderTemplates() {
  const grid = $('#template-grid')
  if (!grid) return
  const groups = [['all', '全部'], ['口播/头像', '口播/头像'], ['图片素材', '图片素材'], ['视频素材', '视频素材'], ['信息数据', '信息数据'], ['风格片头', '风格片头'], ['主题创意', '主题创意']]
  const groupOf = (template) => template.group || template.category || '其他'
  const groupCount = (id) => id === 'all' ? state.templates.length : state.templates.filter((template) => groupOf(template) === id).length
  $('#template-groups').innerHTML = groups.map(([id, label]) => `<button class="chip ${state.templateGroup === id ? 'active' : ''}" data-template-group="${id}">${label} ${groupCount(id)}</button>`).join('')
  const filters = [['all', '全部功能'], ['table', '表格'], ['chart', '数据图'], ['image-slot', '图片位']]
  const countFor = (id) => id === 'all' ? state.templates.length : state.templates.filter((template) => (template.features || []).includes(id)).length
  $('#template-filters').innerHTML = filters.map(([id, label]) => `<button class="chip ${state.templateFeature === id ? 'active' : ''}" data-template-feature="${id}">${label} ${countFor(id)}</button>`).join('')
  let list = state.templates
  if (state.templateGroup !== 'all') list = list.filter((template) => groupOf(template) === state.templateGroup)
  if (state.templateFeature !== 'all') list = list.filter((template) => (template.features || []).includes(state.templateFeature))
  $('#template-count').textContent = `${list.length} / ${state.templates.length} 套`
  if (!list.length) { grid.innerHTML = '<div class="empty">没有符合条件的模板</div>'; return }
  grid.innerHTML = `<div class="template-grid">${list.map((template) => {
    const palette = template.palette || {}
    return `<article class="template-card">
      <div class="template-preview">${template.preview ? `<img src="${escapeHtml(template.preview)}" alt="${escapeHtml(template.name)}" loading="lazy" />` : '<div class="empty">无预览</div>'}</div>
      <div class="template-body">
        <div class="template-head"><h3>${escapeHtml(template.name)}</h3><div class="project-tags">${template.remotion ? '<span class="tag engine">Remotion</span>' : ''}<span class="tag">${escapeHtml(groupOf(template))}</span></div></div>
        <p>${escapeHtml(template.description || '')}</p>
        <div class="palette">${['background', 'primary', 'accent', 'text'].map((key) => `<i style="background:${escapeHtml(palette[key] || '#888')}" title="${key}"></i>`).join('')}</div>
        <div class="project-tags">${(template.tags || []).filter((tag) => !['竖屏', '横屏', '竖版', '横版', '方形', '9:16', '16:9'].includes(tag)).slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        ${Array.isArray(template.features) && template.features.filter((feature) => feature !== 'vertical').length ? `<div class="project-tags">${template.features.filter((feature) => feature !== 'vertical').map((feature) => `<span class="tag">${escapeHtml({ table: '表格', chart: '数据图', 'image-slot': '图片位' }[feature] || feature)}</span>`).join('')}</div>` : ''}
        ${Array.isArray(template.styleRefs) && template.styleRefs.length ? `<div class="project-tags">${template.styleRefs.map((ref) => `<span class="tag">参考 ${escapeHtml(ref)}</span>`).join('')}</div>` : ''}
        <div class="template-actions">
          <button class="btn ghost" data-preview-template="${escapeHtml(template.id)}">预览 10 秒</button>
          <button class="btn" data-use-template="${escapeHtml(template.id)}" ${template.hasSource ? '' : 'disabled'}>${template.hasSource ? (template.remotion ? '用 HTML 版新建项目' : '用这个模板新建项目') : '模板文件未就绪'}</button>
        </div>
      </div>
    </article>`
  }).join('')}</div>`
}

function renderVoiceView() {
  const voice = state.overview.voice
  if (!voice) { $('#voice-view').innerHTML = '<div class="panel"><div class="empty">暂无声音档案</div></div>'; return }
  const projects = state.projects.filter((project) => project.voiceProfile === voice.id || isFilm(project))
  $('#voice-view').innerHTML = `
    <div class="detail-list">
      <section class="panel">
        <div class="panel-head"><div><span class="panel-kicker">声音</span><h2>${escapeHtml(voice.name || voice.id)}</h2></div><span class="verified">已验证</span></div>
        <div class="wave-bars">${waveBars(64)}</div>
        ${voice.referenceUrl ? `<audio controls preload="metadata" src="${escapeHtml(voice.referenceUrl)}" style="width:100%"></audio>` : ''}
        <div class="section-title"><h3>参考音频</h3><span>MiniMax 声音克隆</span></div>
        <div class="kv">
          <div class="meta-line"><span>引擎</span><b>MiniMax</b></div>
          <div class="meta-line"><span>模型</span><b>${escapeHtml((voice.minimax?.model || 'speech-2.8-turbo').replace('speech-', ''))}</b></div>
          <div class="meta-line"><span>编号</span><b>${escapeHtml(voice.id)}</b></div>
          <div class="meta-line"><span>时长</span><b>${formatDuration(voice.duration)}</b></div>
          <div class="meta-line"><span>采样率</span><b>${Number(voice.sampleRate || 0)} 赫兹</b></div>
          <div class="meta-line"><span>声道</span><b>${escapeHtml(voice.channels)}</b></div>
          <div class="meta-line"><span>裁切</span><b>${(voice.trimSeconds || []).join('–')} 秒</b></div>
          <div class="meta-line"><span>大小</span><b>${formatBytes(voice.referenceBytes)}</b></div>
          <div class="meta-line"><span>校验码</span><b>${escapeHtml(voice.sha256Short)}</b></div>
          <div class="meta-line"><span>来源</span><b>${escapeHtml(voice.source)}</b></div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><span class="panel-kicker">使用项目</span><h2>项目</h2></div></div>
        ${projects.length ? projects.map((project) => `<div class="asset-row"><span>${escapeHtml(project.title)}</span><a href="#/p/${escapeHtml(project.id)}" data-open="${escapeHtml(project.id)}">打开 →</a></div>`).join('') : '<div class="empty">暂无项目</div>'}
      </section>
    </div>`
}

/* ---------- 素材库 ---------- */
function assetTabsHtml() {
  const tabs = [['music', '背景音乐'], ['sfx', '音效'], ['images', '图片'], ['files', '文件']]
  return `<div class="library-tabs">${tabs.map(([id, label]) => `<button class="library-tab ${state.assetTab === id ? 'active' : ''}" data-asset-tab="${id}">${label}</button>`).join('')}</div>`
}
function assetChips(items) {
  if (!items.length) return ''
  return `<div class="asset-chips">${items.map(([id, label]) => `<button class="chip ${state.assetFilter === id ? 'active' : ''}" data-asset-filter="${escapeHtml(id)}">${escapeHtml(label)}</button>`).join('')}</div>`
}
function musicCategories(tracks) {
  const map = new Map()
  for (const track of tracks) {
    const id = track.category || 'other'
    const item = map.get(id) || { id, label: track.categoryLabel || prettyCategory(id), count: 0 }
    item.count += 1
    map.set(id, item)
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}
function assetToolbar(placeholder, categories = []) {
  const select = categories.length ? `<select class="asset-select" id="asset-category"><option value="all">全部分类</option>${categories.map((item) => `<option value="${escapeHtml(item.id)}" ${state.assetCategory === item.id ? 'selected' : ''}>${escapeHtml(item.label)}（${item.count}）</option>`).join('')}</select>` : ''
  return `<div class="asset-toolbar"><input class="asset-search" id="asset-search" type="search" autocomplete="off" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(state.assetQuery)}" />${select}<span class="asset-count" id="asset-count"></span></div>`
}
function assetQueryMatch(track) {
  const query = state.assetQuery.trim().toLowerCase()
  if (!query) return true
  const haystack = [track.titleZh, track.title, track.categoryZh, track.category, track.categoryLabel, track.mood, track.attribution, ...(track.tagsZh || []), ...(track.tags || [])].join(' ').toLowerCase()
  return query.split(/\s+/).every((term) => haystack.includes(term))
}
function filteredMusicTracks() {
  let tracks = state.library ? [...(state.library.music.tracks || []), ...(state.library.music.remote || [])] : []
  if (state.assetFilter === 'local' && state.library) tracks = state.library.music.tracks || []
  if (state.assetFilter === 'remote' && state.library) tracks = state.library.music.remote || []
  if (state.assetCategory !== 'all') tracks = tracks.filter((track) => track.category === state.assetCategory)
  return tracks.filter(assetQueryMatch)
}
function filteredSfxTracks() {
  const tracks = state.library?.sfx?.tracks || []
  return tracks.filter((track) => state.assetFilter === 'all' || track.category === state.assetFilter).filter(assetQueryMatch)
}
function musicCard(track) {
  const source = track.source || (track.remote ? 'https://github.com/uncle-sheepsky/duru-ai-cc0-bgm' : '')
  return `<article class="media-card">
    <div class="media-card-head"><span class="media-kind">背景音乐 · ${escapeHtml(track.remote ? '远程' : (track.categoryLabel || prettyCategory(track.category)))}</span><span class="media-license">${escapeHtml(track.license || 'CC0-1.0')}</span></div>
    <h3>${escapeHtml(track.title || track.id)}</h3>
    <div class="media-meta">${escapeHtml(track.mood || '—')} · ${formatDuration(track.duration)}</div>
    <div class="media-tags">${(track.tags || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="media-source"><span>${escapeHtml(track.attribution || '—')}</span>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noreferrer">来源 ↗</a>` : '<span>无来源</span>'}</div>
  </article>`
}
function sfxCard(track) {
  return `<article class="media-card">
    <div class="media-card-head"><span class="media-kind">音效 · ${escapeHtml(track.categoryZh || CATEGORY_ZH[track.category] || track.category)}</span><span class="media-license">${escapeHtml(track.license || 'CC0-1.0')}</span></div>
    <h3>${escapeHtml(sfxTitle(track))}</h3>
    <div class="media-meta">${formatDuration(track.duration)}</div>
    <div class="media-audio"><audio controls preload="none" src="${escapeHtml(track.preview)}"></audio></div>
    <div class="media-tags">${(track.tagsZh || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="media-source"><span>${escapeHtml(track.attribution || '—')}</span><a href="${escapeHtml(track.source || '')}" target="_blank" rel="noreferrer">来源 ↗</a></div>
  </article>`
}
function viewerThumb(gallery, index, url, caption) {
  return `<button class="image-thumb" type="button" data-gallery="${escapeHtml(gallery)}" data-index="${index}" aria-label="${escapeHtml(caption)}"><img src="${escapeHtml(url)}" alt="" loading="lazy" /></button>`
}

function renderAssetsView() {
  const storage = state.overview.storage
  const total = storage.out + storage.projects + storage.voices + (storage.library || 0) || 1
  const assets = []
  for (const project of state.projects) for (const [key, value] of Object.entries(project.assets || {})) if (value) assets.push({ project: project.title, key, value })
  const gallery = state.galleries.all || []
  const musicAll = state.library ? [...(state.library.music.tracks || []), ...(state.library.music.remote || [])] : []
  const sfxAll = state.library?.sfx?.tracks || []
  let content = ''
  let chips = ''
  if (state.assetTab === 'music') {
    const local = state.library?.music.tracks || []
    const remote = state.library?.music.remote || []
    chips = assetChips([['all', `全部 ${musicAll.length}`], ['local', `本地 ${local.length}`], ['remote', `远程 ${remote.length}`]])
    content = `<p class="library-note">本地已收录 ${local.length} 首 Open Lo-Fi（CC0）；远程 DURU ${remote.length} 首由 Agent 按需下载。这里只展示来源和许可证，不提供试听。</p>${assetToolbar('搜索曲名、风格、标签、来源', musicCategories(musicAll))}<div id="asset-list"></div>`
  } else if (state.assetTab === 'sfx') {
    const categories = [...new Set(sfxAll.map((track) => track.category))]
    chips = assetChips([['all', `全部 ${sfxAll.length}`], ...categories.map((category) => [category, `${CATEGORY_ZH[category] || category} ${sfxAll.filter((track) => track.category === category).length}`])])
    content = `<p class="library-note">本地 ${sfxAll.length} 个 CC0 音效，可直接试听。选中后会复制到项目的音效目录，混音时自动使用转场 / 冲击 / 点击。</p>${assetToolbar('搜索音效名、标签、来源')}<div id="asset-list"></div>`
  } else if (state.assetTab === 'images') {
    content = gallery.length ? `<div class="image-grid">${gallery.map((item, index) => `<figure>${viewerThumb('all', index, item.url, item.caption)}<figcaption>${escapeHtml(item.caption)}</figcaption></figure>`).join('')}</div>` : '<div class="empty">暂无生成图片</div>'
  } else {
    content = assets.length ? `<div class="asset-table">${assets.map((asset) => `<div class="asset-row"><span>${escapeHtml(asset.project)} / ${escapeHtml(ASSET_LABELS[asset.key] || asset.key)}</span><a href="${escapeHtml(asset.value)}" target="_blank" rel="noreferrer">打开 ↗</a></div>`).join('')}</div>` : '<div class="empty">暂无文件</div>'
  }
  $('#assets-view').innerHTML = `
    <div class="assets-top">
      <section class="panel">
        <div class="panel-head"><div><span class="panel-kicker">存储</span><h2>存储分布</h2></div><span class="muted">${formatBytes(total)}</span></div>
        <div class="storage-list">${[['输出', storage.out], ['项目', storage.projects], ['声音', storage.voices], ['资源库', storage.library || 0]].map(([label, size]) => `<div class="storage-item"><span>${label}</span><div class="storage-bar"><i style="width:${Math.round(size / total * 100)}%"></i></div><span>${formatBytes(size)}</span></div>`).join('')}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><span class="panel-kicker">资源</span><h2>资源概览</h2></div></div>
        <div class="asset-stats">
          <div><b>${musicAll.length}</b><span>背景音乐</span></div>
          <div><b>${sfxAll.length}</b><span>本地音效</span></div>
          <div><b>${gallery.length}</b><span>生成图片</span></div>
          <div><b>${assets.length}</b><span>交付文件</span></div>
        </div>
      </section>
    </div>
    <section class="panel assets-main">${assetTabsHtml()}${chips}${content}</section>`
  if (state.assetTab === 'music' || state.assetTab === 'sfx') renderAssetList()
}

function renderAssetList() {
  const list = $('#asset-list')
  if (!list) return
  const isMusic = state.assetTab === 'music'
  const tracks = isMusic ? filteredMusicTracks() : filteredSfxTracks()
  const card = isMusic ? musicCard : sfxCard
  const shown = tracks.slice(0, state.assetLimit)
  const rest = tracks.length - shown.length
  list.innerHTML = `${tracks.length ? `<div class="library-grid">${shown.map(card).join('')}</div>` : '<div class="empty">没有匹配的素材</div>'}${rest > 0 ? `<div class="asset-more"><button class="btn" data-asset-more>显示更多（还有 ${rest} 条）</button></div>` : ''}`
  const count = $('#asset-count')
  if (count) count.textContent = `显示 ${shown.length} / ${tracks.length}`
}

function renderSystemView() {
  const { system, storage, stats } = state.overview
  $('#system-view').innerHTML = `
    <div class="detail-list">
      <section class="panel">
        <div class="panel-head"><div><span class="panel-kicker">运行状态</span><h2>本地运行时</h2></div><span class="verified">在线</span></div>
        <div class="kv">
          <div class="meta-line"><span>服务地址</span><b>127.0.0.1:${system.port}</b></div>
          <div class="meta-line"><span>Node 版本</span><b>${escapeHtml(system.node)}</b></div>
          <div class="meta-line"><span>系统</span><b>${escapeHtml(system.platform)}</b></div>
          <div class="meta-line"><span>运行时长</span><b>${Math.round(system.uptime)} 秒</b></div>
          <div class="meta-line"><span>根目录</span><b>${escapeHtml(system.root)}</b></div>
          <div class="meta-line"><span>资源库</span><b>${formatBytes(storage.library || 0)}</b></div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><span class="panel-kicker">统计</span><h2>项目统计</h2></div></div>
        <div class="kv">
          <div class="meta-line"><span>项目</span><b>${stats.projects}</b></div>
          <div class="meta-line"><span>成片</span><b>${stats.films}</b></div>
          <div class="meta-line"><span>模板</span><b>${state.templates.length}</b></div>
          <div class="meta-line"><span>帧数</span><b>${formatNumber(stats.totalFrames)}</b></div>
          <div class="meta-line"><span>总时长</span><b>${formatDuration(stats.totalDuration)}</b></div>
          <div class="meta-line"><span>输出大小</span><b>${formatBytes(storage.out)}</b></div>
        </div>
      </section>
    </div>`
}

/* ---------- 项目页 ---------- */
async function openProject(id, tab = 'overview') {
  try {
    const data = await request(`/api/projects/${encodeURIComponent(id)}`)
    state.current = data.project
    const index = state.projects.findIndex((project) => project.id === data.project.id)
    if (index >= 0) state.projects[index] = { ...state.projects[index], ...data.project }
    buildGalleries()
    state.projectTab = tab
    document.body.classList.add('project-open')
    $$('.view').forEach((element) => { element.hidden = element.id !== 'view-project' })
    $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'projects'))
    $('#view-project').hidden = false
    history.replaceState(null, '', `#/p/${encodeURIComponent(id)}/${tab}`)
    renderProjectPage()
  } catch (error) {
    showToast(`打开失败：${error.message}`)
  }
}
function closeProject(updateHash = true) {
  state.current = null
  document.body.classList.remove('project-open')
  $('#view-project').hidden = true
  if (updateHash) history.replaceState(null, '', '#/projects')
  if (updateHash) switchView('projects')
}

const PROJECT_TABS = [['overview', '详情'], ['flow', '流程'], ['research', '研究'], ['script', '文案'], ['voice', '声音'], ['assets', '素材']]

function renderProjectPage() {
  const project = state.current
  if (!project) return
  $('#project-bar').innerHTML = `
    <div class="project-bar-left"><button class="btn ghost" id="project-back">← 项目</button>
      <div><div class="project-title-row"><h1>${escapeHtml(project.title)}</h1><span class="badge status ${statusClass(project.status)}"><i></i>${statusLabel(project.status)}</span></div>
      <div class="project-sub">${escapeHtml(project.subtitle || project.summary || '')}${project.duration ? ` · ${formatDuration(project.duration)}` : ''}</div></div></div>
    <div class="project-bar-actions">
      <button class="btn ghost" id="project-refresh">刷新</button>
      <button class="btn" id="project-export">导出成片</button>
    </div>`
  $('#project-tabs').innerHTML = PROJECT_TABS.map(([id, label]) => `<button class="project-tab ${state.projectTab === id ? 'active' : ''}" data-project-tab="${id}">${label}</button>`).join('')
  const body = $('#project-body')
  if (state.projectTab === 'overview') body.innerHTML = overviewHtml(project)
  else if (state.projectTab === 'flow') body.innerHTML = flowHtml(project)
  else if (state.projectTab === 'research') body.innerHTML = researchHtml(project)
  else if (state.projectTab === 'script') body.innerHTML = scriptHtml(project)
  else if (state.projectTab === 'voice') body.innerHTML = voicePageHtml(project)
  else if (state.projectTab === 'assets') body.innerHTML = projectAssetsHtml(project)
  else body.innerHTML = overviewHtml(project)
  if (state.projectTab === 'overview') { bindOverviewVideo(project); bindIssueBox(project) }
  else state.issueFlush = null
}

function overviewHtml(project) {
  const tech = project.tech || {}
  const spec = project.spec || null
  const orientationZh = { landscape: '横屏', portrait: '竖屏', square: '方形' }
  const audioZh = { source: '原声', clone: '克隆配音', none: '无人声', undecided: '待定' }
  const specWarning = !spec ? '规格未确认' : project.layoutAdapted === false ? '版式待适配' : ''
  const video = project.assets?.video
  const poster = project.assets?.poster
  const lines = project.voiceLines || []
  const scenes = project.scenes || []
  const issue = project.issues || { text: '', updatedAt: null }
  const stageLabel = project.stage === 'review' ? '审阅' : (STAGE_ZH[project.stage] || project.stage || '制作中')
  const presets = ['开头再抓人一点', '节奏快一点', '音乐小一点', '第三句再口语一点', '结尾换一版']
  const scriptRows = lines.map((line) => {
    const scene = scenes.find((item) => item.line === line.id || item.scene === line.scene)
    const start = Number(scene?.start ?? 0)
    const end = Number(scene?.end ?? start + Number(line.duration || 0))
    return `<button class="script-row" type="button" data-scene-start="${start}" data-scene-end="${end}" title="跳到 ${timecode(start)}">
      <time>${timecode(start)}</time>
      <span>${escapeHtml(line.text || '')}</span>
    </button>`
  }).join('')
  return `<div class="project-home">
    <section class="panel film-panel">
      <div class="film-head">
        <div>
          <span class="panel-kicker">成片</span><h2>成片预览</h2>
          <div class="film-facts">
            <span>${formatDuration(project.duration)}</span>
            <span>${escapeHtml(spec ? `${spec.width} × ${spec.height}` : `${tech.width || 1920} × ${tech.height || 1080}`)}</span>
            <span>${escapeHtml(spec ? `${spec.fps} fps` : `${tech.fps || 30} fps`)}</span>
            ${specWarning ? `<span class="spec-warn">${escapeHtml(specWarning)}</span>` : ''}
          </div>
        </div>
        <div class="film-actions">
          ${video ? `<a class="btn" href="${escapeHtml(video)}" download>下载成片</a>` : ''}
          ${poster ? `<a class="btn ghost" href="${escapeHtml(poster)}" target="_blank" rel="noreferrer">看封面</a>` : ''}
          <button class="btn ghost" data-project-tab="script">看文案</button>
        </div>
      </div>
      ${video
        ? `<div class="film-player"><video id="project-video" controls playsinline preload="metadata"${poster ? ` poster="${escapeHtml(poster)}"` : ''} src="${escapeHtml(video)}"></video></div>`
        : `<div class="film-player film-empty" style="aspect-ratio:${Number(spec?.width || tech.width || 16)} / ${Number(spec?.height || tech.height || 9)}"><div><b>还没有成片</b><p>把声音、画面和混音做完，再导出一版。</p><button class="btn" data-export="1">导出成片</button></div></div>`}
    </section>

    <aside class="project-rail">
      <section class="panel review-card">
        <div class="review-state"><span class="badge status ${statusClass(project.status)}"><i></i>${statusLabel(project.status)}</span><span>${escapeHtml(stageLabel)}阶段</span></div>
        <div class="issue-head">
          <div><span class="panel-kicker">给 AI</span><h2>问题记录</h2></div>
          <span class="issue-state" id="issue-state">${issue.updatedAt ? `已保存 ${formatDate(issue.updatedAt)}` : '未填写'}</span>
        </div>
        <p class="review-lead">一条一条写，边看边改。Agent 会读这里的记录，改完再重出片。</p>
        <textarea class="issue-text" id="issue-text" maxlength="20000" placeholder="比如：&#10;- 开头再快一点&#10;- 音乐小一点&#10;- 第三句换掉">${escapeHtml(issue.text || '')}</textarea>
        <div class="review-chips">${presets.map((text) => `<button class="review-chip" type="button" data-review-preset="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}</div>
        <div class="review-hint">自动保存到 issues.json，不用点保存。</div>
      </section>
    </aside>

    <section class="panel film-script">
      <div class="panel-head compact">
        <div><span class="panel-kicker">文案</span><h2>文案与节奏</h2></div>
        <div class="film-script-head"><span>${lines.length} 句 · 点句子跳到对应画面</span><button class="btn ghost" data-project-tab="script">编辑文案</button></div>
      </div>
      <div class="script-review">${scriptRows || '<div class="empty">还没有文案</div>'}</div>
    </section>

    <section class="panel film-advanced">
      <details>
        <summary>工程信息与文件<span>项目编号、模板、声音、全部产物</span></summary>
        <div class="advanced-body">
          <div class="advanced-meta">
            <div><span>项目编号</span><b>${escapeHtml(project.id)}</b></div>
            <div><span>规格</span><b>${escapeHtml(spec ? `${orientationZh[spec.orientation] || spec.orientation} ${spec.width}×${spec.height} · ${spec.fps}fps · ${spec.duration} 秒` : '未确认')}</b></div>
            <div><span>平台 / 声音</span><b>${escapeHtml(spec ? [spec.platform || '未填平台', audioZh[spec.audio] || spec.audio || '待定'].join(' · ') : '—')}</b></div>
            <div><span>模板</span><b>${escapeHtml(project.templateMeta?.name || project.template || '自定义')}</b></div>
            <div><span>风格</span><b>${escapeHtml(project.templateMeta?.category || '—')}</b></div>
            <div><span>声音</span><b>${escapeHtml((project.voiceProfile || '—').toUpperCase())}</b></div>
            <div><span>更新时间</span><b>${formatDate(project.updatedAt)}</b></div>
            <div><span>流程</span><b>${(project.pipeline || []).filter((step) => step.status === 'done').length}/${(project.pipeline || []).length || 6} 步完成</b></div>
          </div>
          <div class="asset-table">${Object.entries(project.assets || {}).filter(([, value]) => value).map(([key, value]) => `<div class="asset-row"><span>${escapeHtml(ASSET_LABELS[key] || key)}</span><a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">打开 ↗</a></div>`).join('')}</div>
        </div>
      </details>
    </section>
  </div>`
}

function bindOverviewVideo(project) {
  const video = $('#project-video')
  const rows = $$('.script-row')
  if (!video || !rows.length) return
  const update = () => {
    const time = video.currentTime
    let current = null
    rows.forEach((row) => {
      const start = Number(row.dataset.sceneStart || 0)
      const end = Number(row.dataset.sceneEnd || start)
      if (time >= start && time < end && (!current || start >= Number(current.dataset.sceneStart || 0))) current = row
    })
    rows.forEach((row) => row.classList.toggle('active', row === current))
  }
  video.addEventListener('timeupdate', update)
  update()
}

function bindIssueBox(project) {
  const box = $('#issue-text')
  if (!box) return
  const label = $('#issue-state')
  let savedText = String(project.issues?.text || '')
  let savedAt = project.issues?.updatedAt || null
  const setState = (text, state = '') => {
    if (!label) return
    label.textContent = text
    label.dataset.state = state
  }
  const save = async () => {
    clearTimeout(state.issueTimer)
    state.issueTimer = null
    if (!state.current) return
    const text = box.value
    if (text === savedText) {
      if (savedAt) setState(`已保存 ${formatDate(savedAt)}`)
      return
    }
    setState('保存中…', 'saving')
    try {
      const data = await request(`/api/projects/${encodeURIComponent(state.current.id)}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      savedText = data.issue.text
      savedAt = data.issue.updatedAt
      state.current.issues = data.issue
      if (box.value === text) setState(`已保存 ${formatDate(savedAt)}`, 'saved')
      else {
        setState('未保存', 'dirty')
        state.issueTimer = setTimeout(save, 600)
      }
    } catch (error) {
      setState('保存失败', 'error')
    }
  }
  state.issueFlush = save
  box.addEventListener('input', () => {
    setState('未保存', 'dirty')
    clearTimeout(state.issueTimer)
    state.issueTimer = setTimeout(save, 800)
  })
  box.addEventListener('blur', () => {
    if (state.issueTimer) save()
  })
}

function flowHtml(project) {
  const pipeline = project.pipeline || []
  const issue = project.issues || {}
  return `<div class="flow-page">
    <div class="flow-note"><span>修改意见统一写在详情页右侧「问题记录」，自动保存。</span><button class="link-btn" data-project-tab="overview">去详情页写 →</button></div>
    ${issue.text ? `<section class="panel flow-issue">
      <div class="panel-head"><div><span class="panel-kicker">问题记录</span><h2>Agent 会读到的内容</h2></div><button class="btn ghost" data-project-tab="overview">编辑</button></div>
      <pre class="flow-issue-text">${escapeHtml(issue.text)}</pre>
      <div class="flow-issue-meta">自动保存于 ${formatDate(issue.updatedAt)} · projects/${escapeHtml(project.dir || project.id)}/issues.json</div>
    </section>` : ''}
    <div class="flow-list">${pipeline.map((step, index) => {
      const stage = step.id
      const label = STAGE_ZH[stage] || step.label
      return `<section class="panel flow-stage">
        <div class="flow-stage-head">
          <div class="flow-stage-title"><span class="flow-index">${String(index + 1).padStart(2, '0')}</span><div><span class="panel-kicker">阶段</span><h2>${escapeHtml(label)}</h2></div></div>
          <span class="status ${step.status === 'done' ? 'done' : step.status === 'doing' ? 'review' : 'template'}"><i></i>${step.status === 'done' ? '已完成' : step.status === 'doing' ? '进行中' : '未开始'}</span>
        </div>
      </section>`
    }).join('')}</div>
  </div>`
}

function researchHtml(project) {
  const brief = project.brief || {}
  const feasibility = brief.feasibility || {}
  return `<form class="panel research-form" id="research-form">
    <div class="panel-head"><div><span class="panel-kicker">研究</span><h2>选题与可行性</h2></div><span class="muted">Agent 会先读这里的资料，再写文案</span></div>
    <div class="form-grid">
      <label><span>主题</span><input name="topic" value="${escapeHtml(brief.topic || '')}" /></label>
      <label><span>受众</span><input name="audience" value="${escapeHtml(brief.audience || '')}" /></label>
      <label class="wide"><span>切入角度</span><textarea name="angle" rows="3">${escapeHtml(brief.angle || '')}</textarea></label>
      <label><span>形式</span><input name="format" value="${escapeHtml(brief.format || '30 秒短片')}" /></label>
      <label><span>可行性评分（0–10）</span><input name="score" type="number" min="0" max="10" value="${escapeHtml(feasibility.score ?? '')}" /></label>
      <label><span>结论</span><select name="decision"><option value="pending" ${feasibility.decision === 'pending' ? 'selected' : ''}>待定</option><option value="go" ${feasibility.decision === 'go' ? 'selected' : ''}>可以做</option><option value="pause" ${feasibility.decision === 'pause' ? 'selected' : ''}>先暂停</option><option value="drop" ${feasibility.decision === 'drop' ? 'selected' : ''}>放弃</option></select></label>
      <label class="wide"><span>风险与限制（一行一条）</span><textarea name="risks" rows="4">${escapeHtml((feasibility.risks || []).join('\n'))}</textarea></label>
      <label class="wide"><span>参考资料（标题 | 链接 | 备注，一行一条）</span><textarea name="references" rows="4">${escapeHtml((brief.references || []).map((item) => `${item.title || ''} | ${item.url || ''} | ${item.note || ''}`).join('\n'))}</textarea></label>
      <label class="wide"><span>图片计划</span><textarea name="imagePlan" rows="4">${escapeHtml((brief.imagePlan || []).map((item) => `${item.scene || ''} | ${item.prompt || ''} | ${item.status || ''}`).join('\n'))}</textarea></label>
    </div>
    <div class="form-actions"><button class="btn" type="submit">保存研究资料</button></div>
  </form>`
}

function scriptHtml(project) {
  const lines = project.voiceLines?.length ? project.voiceLines : []
  return `<div class="script-editor">
    <section class="panel">
      <div class="panel-head"><div><span class="panel-kicker">文案</span><h2>标题与说明</h2></div></div>
      <div class="form-grid">
        <label><span>标题</span><input name="title" value="${escapeHtml(project.title || '')}" /></label>
        <label><span>副标题</span><input name="subtitle" value="${escapeHtml(project.subtitle || '')}" /></label>
        <label class="wide"><span>摘要</span><textarea name="summary" rows="2">${escapeHtml(project.summary || '')}</textarea></label>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><div><span class="panel-kicker">逐句</span><h2>文案分句</h2></div><span class="muted">${lines.length} 句</span></div>
      <div class="script-lines">${lines.map((line) => `<label class="script-line"><span>${escapeHtml(line.id)}</span><textarea data-line-id="${escapeHtml(line.id)}" rows="2">${escapeHtml(line.text || '')}</textarea><em>${formatDuration(line.duration)}</em></label>`).join('')}</div>
      <div class="form-actions"><button class="btn" id="save-script">保存文案</button><button class="btn ghost" id="save-script-voice">保存并重新生成声音</button></div>
    </section>
  </div>`
}

function voicePageHtml(project) {
  return `<div class="detail-grid"><section class="panel"><div class="panel-head"><div><span class="panel-kicker">声音</span><h2>混音与人声</h2></div></div>${audioRows(project)}</section><section class="panel"><div class="panel-head"><div><span class="panel-kicker">声音档案</span><h2>${escapeHtml((project.voiceProfile || '—').toUpperCase())}</h2></div></div><div class="kv"><div class="meta-line"><span>模型</span><b>MiniMax speech-2.8-turbo</b></div><div class="meta-line"><span>模式</span><b>声音克隆</b></div><div class="meta-line"><span>句数</span><b>${project.voiceLines?.length || 0}</b></div></div></section></div>`
}

function audioRows(project) {
  const rows = []
  if (project.assets?.mix) rows.push(`<div class="audio-main"><audio controls preload="metadata" src="${escapeHtml(project.assets.mix)}"></audio></div>`)
  if (project.voiceLines?.length) {
    rows.push(`<div class="section-title"><h3>逐句声音</h3><span>${project.voiceLines.length} 段</span></div>`)
    rows.push(project.voiceLines.map((line) => `<div class="line-row"><span class="no">${escapeHtml(line.id)}</span><span class="txt">${escapeHtml(line.text)}</span><span class="dur">${formatDuration(line.duration)}</span>${line.file ? `<audio controls preload="metadata" src="${escapeHtml(line.file)}"></audio>` : ''}</div>`).join(''))
  }
  return rows.join('')
}

function projectAssetsHtml(project) {
  return `<div class="project-assets">
    <section class="panel"><div class="panel-head"><div><span class="panel-kicker">导入</span><h2>项目素材</h2></div><button class="btn" data-import="1">导入素材</button></div>
      <p class="muted">导入的文件会保存到 <code>projects/${escapeHtml(project.dir || project.id)}/assets/imported/</code>，Agent 可以直接读取和分析。</p>
      <div class="asset-table">${(project.imports || []).length ? project.imports.map((item) => `<div class="asset-row"><span>${escapeHtml(item.name)} · ${formatBytes(item.bytes)}</span><div><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开 ↗</a> ${item.analysis ? '<span class="tag">已分析</span>' : '<span class="tag">待分析</span>'}</div></div>`).join('') : '<div class="empty">还没有导入素材</div>'}</div>
    </section>
    <section class="panel"><div class="panel-head"><div><span class="panel-kicker">生成图片</span><h2>图片</h2></div></div>${(project.images || []).length ? `<div class="image-grid">${project.images.map((image, index) => `<figure>${viewerThumb(`project:${project.id}`, index, mediaPath(image), String(image).split('/').pop())}<figcaption>${escapeHtml(String(image).split('/').pop())}</figcaption></figure>`).join('')}</div>` : '<div class="empty">暂无图片</div>'}</section>
    <section class="panel"><div class="panel-head"><div><span class="panel-kicker">文件</span><h2>工程与产物</h2></div></div><div class="asset-table">${Object.entries(project.assets || {}).filter(([, value]) => value).map(([key, value]) => `<div class="asset-row"><span>${escapeHtml(ASSET_LABELS[key] || key)}</span><a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">打开 ↗</a></div>`).join('')}</div></section>
  </div>`
}

/* ---------- 任务 ---------- */
async function startExport(project, options = {}) {
  try {
    const data = await request(`/api/projects/${encodeURIComponent(project.id)}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) })
    state.job = data.job
    pollJob(data.job.id)
    showToast('已开始导出，完成后会提示')
  } catch (error) { showToast(error.message) }
}

function pollJob(id) {
  clearTimeout(state.jobTimer)
  const tick = async () => {
    try {
      const data = await request(`/api/jobs/${encodeURIComponent(id)}`)
      state.job = data.job
      if (data.job.status === 'running') state.jobTimer = setTimeout(tick, 1200)
      else {
        if (data.job.status === 'done') {
          showToast('任务完成')
          const project = await request(`/api/projects/${encodeURIComponent(state.current.id)}`)
          state.current = project.project
          renderProjectPage()
        } else {
          const lastLog = (data.job.logs || []).filter(Boolean).slice(-1)[0]
          showToast(lastLog ? `任务失败：${lastLog}` : '任务失败，查看日志')
        }
      }
    } catch (error) { showToast(`任务状态读取失败：${error.message}`) }
  }
  tick()
}

/* ---------- 事件 ---------- */
function bindNav() {
  $('#nav').addEventListener('click', (event) => {
    const button = event.target.closest('.nav-item')
    if (button) switchView(button.dataset.view)
  })
  $('#refresh').addEventListener('click', async () => { await loadAll(); showToast('已刷新') })
  $('#search').addEventListener('input', (event) => {
    state.search = event.target.value
    renderProjectTable($('#project-table'), filteredProjects())
    renderProjectTable($('#project-table-full'), filteredProjects())
  })
  $('#filters').addEventListener('click', (event) => {
    const button = event.target.closest('.filter'); if (!button) return
    state.filter = button.dataset.filter
    $$('#filters .filter').forEach((item) => item.classList.toggle('active', item === button))
    renderProjectTable($('#project-table'), filteredProjects())
  })
  $('#filters-projects').addEventListener('click', (event) => {
    const button = event.target.closest('.filter'); if (!button) return
    state.filter = button.dataset.filter
    $$('#filters-projects .filter').forEach((item) => item.classList.toggle('active', item === button))
    renderProjectTable($('#project-table-full'), filteredProjects())
  })
}

function bindAssets() {
  document.addEventListener('click', (event) => {
    const thumb = event.target.closest('[data-gallery]')
    if (thumb) { openViewer(thumb.dataset.gallery, Number(thumb.dataset.index || 0)); return }
    const open = event.target.closest('[data-open]')
    if (open) { event.preventDefault(); openProject(open.dataset.open); return }
    const row = event.target.closest('.project-row')
    if (row) { openProject(row.dataset.id); return }
    const feature = event.target.closest('[data-template-feature]')
    if (feature) { state.templateFeature = feature.dataset.templateFeature; renderTemplates(); return }
    const group = event.target.closest('[data-template-group]')
    if (group) { state.templateGroup = group.dataset.templateGroup; renderTemplates(); return }
    const preview = event.target.closest('[data-preview-template]')
    if (preview) { openTemplatePreview(preview.dataset.previewTemplate); return }
    const template = event.target.closest('[data-use-template]')
    if (template) { createFromTemplate(template.dataset.useTemplate); return }
  })
  $('#assets-view').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-asset-tab]')
    if (tab) { state.assetTab = tab.dataset.assetTab; state.assetFilter = 'all'; state.assetCategory = 'all'; state.assetQuery = ''; state.assetLimit = 48; renderAssetsView(); return }
    const chip = event.target.closest('[data-asset-filter]')
    if (chip) { state.assetFilter = chip.dataset.assetFilter; state.assetLimit = 48; renderAssetsView(); return }
    if (event.target.closest('[data-asset-more]')) { state.assetLimit += 48; renderAssetList() }
  })
  $('#assets-view').addEventListener('input', (event) => {
    if (event.target.id !== 'asset-search') return
    state.assetQuery = event.target.value; state.assetLimit = 48; renderAssetList()
  })
  $('#assets-view').addEventListener('change', (event) => {
    if (event.target.id !== 'asset-category') return
    state.assetCategory = event.target.value; state.assetLimit = 48; renderAssetList()
  })
  $('#lightbox-prev').addEventListener('click', () => stepViewer(-1))
  $('#lightbox-next').addEventListener('click', () => stepViewer(1))
  $('#lightbox').addEventListener('click', (event) => { if (event.target.closest('[data-viewer-close]')) closeViewer() })
}

function bindProject() {
  $('#project-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-project-tab]')
    if (!tab) return
    state.projectTab = tab.dataset.projectTab
    history.replaceState(null, '', `#/p/${encodeURIComponent(state.current.id)}/${state.projectTab}`)
    renderProjectPage()
  })
  $('#project-bar').addEventListener('click', async (event) => {
    if (event.target.closest('#project-back')) { await state.issueFlush?.(); closeProject(); return }
    if (event.target.closest('#project-refresh')) { await state.issueFlush?.(); await openProject(state.current.id, state.projectTab); return }
    if (event.target.closest('#project-export')) startExport(state.current, {})
  })
  $('#project-body').addEventListener('click', async (event) => {
    if (event.target.closest('[data-import]')) { $('#import-input').click(); return }
    if (event.target.closest('[data-export]')) { startExport(state.current, {}); return }
    const sceneRow = event.target.closest('[data-scene-start]')
    if (sceneRow) {
      event.preventDefault()
      const video = $('#project-video')
      if (video) {
        video.currentTime = Number(sceneRow.dataset.sceneStart || 0)
        video.play().catch(() => {})
      }
      return
    }
    const preset = event.target.closest('[data-review-preset]')
    if (preset) {
      const textarea = $('#issue-text')
      if (textarea) {
        const text = preset.dataset.reviewPreset || ''
        textarea.value = textarea.value.trim() ? `${textarea.value.trim()}\n${text}` : text
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.focus()
      }
      return
    }
    if (event.target.closest('[data-project-tab]')) { state.projectTab = event.target.closest('[data-project-tab]').dataset.projectTab; renderProjectPage(); return }
    if (event.target.closest('#save-script')) { await saveScript(false); return }
    if (event.target.closest('#save-script-voice')) { await saveScript(true); return }
  })
  $('#project-body').addEventListener('submit', async (event) => {
    const form = event.target
    if (form.id === 'research-form') {
      event.preventDefault()
      const data = new FormData(form)
      const risks = String(data.get('risks') || '').split('\n').map((line) => line.trim()).filter(Boolean)
      const references = String(data.get('references') || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [title, url, note] = line.split('|').map((part) => part.trim())
        return { title: title || line, url: url || '', note: note || '' }
      })
      const imagePlan = String(data.get('imagePlan') || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [scene, prompt, status] = line.split('|').map((part) => part.trim())
        return { scene: scene || '', prompt: prompt || '', status: status || '待生成' }
      })
      try {
        await request(`/api/projects/${encodeURIComponent(state.current.id)}/brief`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          topic: String(data.get('topic') || ''), audience: String(data.get('audience') || ''), angle: String(data.get('angle') || ''),
          format: String(data.get('format') || ''), feasibility: { score: data.get('score') ? Number(data.get('score')) : null, decision: String(data.get('decision') || 'pending'), risks },
          references, imagePlan,
        }) })
        showToast('研究资料已保存'); await openProject(state.current.id, 'research')
      } catch (error) { showToast(error.message) }
    }
  })
  $('#import-input').addEventListener('change', async (event) => {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    await importFiles(files)
  })
  $('#project-body').addEventListener('dragover', (event) => {
    if (state.current) event.preventDefault()
  })
  $('#project-body').addEventListener('drop', async (event) => {
    if (!state.current) return
    event.preventDefault()
    const files = [...(event.dataTransfer?.files || [])]
    if (files.length) await importFiles(files)
  })
}

async function saveScript(withVoice) {
  const lines = $$('[data-line-id]').filter((element) => element.tagName === 'TEXTAREA').map((element) => ({ id: element.dataset.lineId, text: element.value }))
  const title = document.querySelector('.script-editor input[name="title"]')?.value
  const subtitle = document.querySelector('.script-editor input[name="subtitle"]')?.value
  const summary = document.querySelector('.script-editor textarea[name="summary"]')?.value
  try {
    await request(`/api/projects/${encodeURIComponent(state.current.id)}/script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines, title, subtitle, summary }) })
    showToast('文案已保存')
    if (withVoice) await startExport(state.current, { regenerateVoice: true })
    else await openProject(state.current.id, 'script')
  } catch (error) { showToast(error.message) }
}

async function importFiles(files) {
  if (!state.current) return showToast('先打开一个项目')
  for (const file of files) {
    try {
      await request(`/api/projects/${encodeURIComponent(state.current.id)}/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), 'X-File-Type': file.type || 'application/octet-stream' }, body: file,
      })
    } catch (error) { showToast(`${file.name} 导入失败：${error.message}`) }
  }
  showToast(`已导入 ${files.length} 个文件`)
  await openProject(state.current.id, state.projectTab)
}

function createFromTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId)
  if (!template) return
  state.templateChoice = template
  $('#template-dialog-name').textContent = `${template.name} · ${template.category || '模板'}${template.remotion ? ' · Remotion 预览，导出仍走 HTML' : ''}`
  const form = $('#template-form')
  form.reset()
  const errorBox = $('#template-spec-error')
  if (errorBox) { errorBox.hidden = true; errorBox.innerHTML = '' }
  $('#template-dialog').hidden = false
  form.querySelector('[name="title"]').focus()
}

async function submitTemplateForm(event) {
  event.preventDefault()
  const template = state.templateChoice
  if (!template) return
  const data = new FormData(event.target)
  const title = String(data.get('title') || '').trim()
  const id = String(data.get('id') || '').trim().toLowerCase()
  const spec = {
    orientation: String(data.get('orientation') || ''),
    quality: String(data.get('quality') || '1080p'),
    fps: Number(data.get('fps') || 30),
    duration: Number(data.get('duration') || 0),
    platform: String(data.get('platform') || '').trim(),
    audio: String(data.get('audio') || 'undecided'),
  }
  const errorBox = $('#template-spec-error')
  const showSpecError = (message, questions = []) => {
    errorBox.hidden = false
    errorBox.innerHTML = `<b>${escapeHtml(message)}</b>${questions.length ? `<ul>${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ul>` : ''}`
  }
  if (!spec.orientation) { showSpecError('先选画幅：横屏、竖屏还是方形。'); return }
  if (!Number.isFinite(spec.duration) || spec.duration <= 0) { showSpecError('需要确认目标时长（秒）。'); return }
  errorBox.hidden = true
  try {
    const result = await request('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title, template: template.id, spec }) })
    $('#template-dialog').hidden = true
    await loadAll()
    await openProject(result.project.id, 'edit')
    showToast(result.needsLayoutAdaptation ? '项目已创建，版式需要按目标画幅适配' : '项目已创建')
  } catch (error) {
    if (Array.isArray(error.data?.questions) && error.data.questions.length) showSpecError(error.message, error.data.questions)
    else showToast(error.message)
  }
}

/* ---------- 模板 10 秒预览 ---------- */
function previewEngineOf(template) {
  return template.remotion && window.NutCutRemotion ? 'remotion' : 'html'
}

function openTemplatePreview(id) {
  const template = state.templates.find((item) => item.id === id)
  if (!template) return
  stopTemplatePreview(false)
  const engine = previewEngineOf(template)
  const remotion = engine === 'remotion' ? template.remotion : null
  const total = remotion ? Number(remotion.durationInFrames) / Number(remotion.fps) : PREVIEW_TOTAL
  state.preview = { template, engine, remotion, handle: null, total, time: 0, playing: true, raf: null, last: 0, ready: false, lastFrame: null, inputs: null }
  $('#preview-title').textContent = `${template.name} · 10 秒预览`
  $('#preview-sub').textContent = engine === 'remotion'
    ? `${template.group || template.category || '模板'} · Remotion 实时预览 · 演示内容 · 原生画布 ${remotion.width} × ${remotion.height}`
    : `${template.group || template.category || '模板'} · 4 段 · 3 次转场 · ${template.width || 1920} × ${template.height || 1080}`
  $('#preview-time').textContent = `0.0 / ${total.toFixed(1)} 秒`
  $('#preview-seek').max = String(total)
  $('#preview-seek').value = '0'
  $('#preview-engine').textContent = engine === 'remotion' ? 'Remotion' : 'HTML'
  $('#preview-segment').textContent = engine === 'remotion' ? '第 1 章 · 开场' : '第 1 段 · 开场'
  $('#preview-play').textContent = '暂停'
  $('#template-preview').hidden = false

  if (engine === 'remotion') {
    mountRemotionPreview(template)
    return
  }

  $('#preview-remotion').hidden = true
  const iframe = $('#preview-frame')
  iframe.hidden = false
  iframe.style.width = `${template.width || 1920}px`
  iframe.style.height = `${template.height || 1080}px`
  const token = String(Date.now())
  iframe.dataset.previewToken = token
  iframe.onload = () => {
    if (iframe.dataset.previewToken !== token) return
    if (!String(iframe.src || '').includes('/media/templates/')) return
    const start = () => {
      if (iframe.dataset.previewToken !== token) return
      state.preview.ready = true
      fitTemplatePreview()
      state.preview.last = 0
      startTemplatePreviewLoop()
    }
    const check = (attempt = 0) => {
      if (iframe.dataset.previewToken !== token) return
      if (typeof iframe.contentWindow?.renderFrame === 'function') { start(); return }
      if (attempt < 6) { setTimeout(() => check(attempt + 1), 120); return }
      showToast('模板没有 renderFrame，无法预览')
    }
    check()
  }
  iframe.src = `/media/templates/${encodeURIComponent(id)}/src/index.html?preview=${token}`
}

function fitPreviewCard() {
  const card = $('.preview-card')
  const template = state.preview.template
  if (!card || !template) return
  const remotion = state.preview.remotion
  const width = Number(remotion?.width || template.width || 1920)
  const height = Number(remotion?.height || template.height || 1080)
  const ratio = width / height
  const chrome = 112
  const cardHeight = Math.min(window.innerHeight * 0.86, window.innerWidth * 0.96 * 0.5625 + chrome)
  const contentHeight = Math.max(240, cardHeight - chrome)
  const target = Math.min(1280, Math.max(400, contentHeight * ratio + 2))
  card.style.width = `${Math.round(target)}px`
  card.classList.toggle('narrow', target < 700)
}

function mountRemotionPreview(template) {
  fitPreviewCard()
  const iframe = $('#preview-frame')
  if (iframe) {
    iframe.onload = null
    iframe.dataset.previewToken = ''
    iframe.hidden = true
  }
  const host = $('#preview-remotion')
  if (!host) return
  host.hidden = false
  host.innerHTML = ''
  const remotion = template.remotion
  try {
    state.preview.handle = window.NutCutRemotion.mount(host, {
      composition: remotion.composition,
      inputProps: remotion.props || {},
      width: remotion.width,
      height: remotion.height,
      fps: remotion.fps,
      durationInFrames: remotion.durationInFrames,
      loop: true,
      autoplay: true,
    })
    state.preview.ready = true
    fitTemplatePreview()
    state.preview.last = 0
    startTemplatePreviewLoop()
  } catch (error) {
    showToast(`Remotion 预览启动失败：${error.message}`)
  }
}

function fitTemplatePreview() {
  const frame = $('.preview-frame')
  const template = state.preview.template
  if (!frame || !template) return
  const remotion = state.preview.remotion
  const width = Number(remotion?.width || template.width || 1920)
  const height = Number(remotion?.height || template.height || 1080)
  const scale = Math.min(frame.clientWidth / width, frame.clientHeight / height)
  const offsetX = (frame.clientWidth - width * scale) / 2
  const offsetY = (frame.clientHeight - height * scale) / 2
  const target = state.preview.engine === 'remotion' ? $('#preview-remotion') : $('#preview-frame')
  if (!target) return
  target.style.width = `${width}px`
  target.style.height = `${height}px`
  target.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
}

function renderTemplatePreview(time) {
  const preview = state.preview
  if (!preview.ready) return
  const total = Number(preview.total || PREVIEW_TOTAL)
  if (preview.engine === 'remotion') {
    $('#preview-time').textContent = `${Math.min(total, Math.max(0, time)).toFixed(1)} / ${total.toFixed(1)} 秒`
    $('#preview-seek').value = String(Math.min(total, Math.max(0, time)))
    const index = Math.min(3, Math.floor(time / (total / 4)))
    $('#preview-segment').textContent = `第 ${index + 1} 章 · ${index === 0 ? '开场' : '章节切换'}`
    return
  }
  const template = preview.template || {}
  const duration = Number(template.duration || 30)
  const short = duration <= 12
  const segment = Math.min(3, Math.floor(time / PREVIEW_SEGMENT_SECONDS))
  const local = time - segment * PREVIEW_SEGMENT_SECONDS
  const sourceTime = short ? Math.min(duration, time) : Math.min(duration, PREVIEW_SEGMENTS[segment] + local)
  const frame = Math.round(sourceTime * 30)
  const win = $('#preview-frame')?.contentWindow
  if (win && typeof win.renderFrame === 'function' && frame !== state.preview.lastFrame) {
    win.renderFrame(frame, state.preview.inputs || {})
    state.preview.lastFrame = frame
  }
  $('#preview-time').textContent = `${time.toFixed(1)} / ${PREVIEW_TOTAL.toFixed(1)} 秒`
  $('#preview-seek').value = String(Math.min(PREVIEW_TOTAL, time))
  $('#preview-segment').textContent = segment === 0 ? '第 1 段 · 开场' : `第 ${segment + 1} 段 · 转场 ${segment}`
}

function startTemplatePreviewLoop() {
  stopTemplatePreviewLoop()
  const loop = (now) => {
    const preview = state.preview
    if (!preview.template) return
    if (preview.engine === 'remotion') {
      const handle = preview.handle
      if (handle && handle.isReady()) {
        const seconds = handle.getCurrentFrame() / Number(preview.remotion.fps || 30)
        preview.time = seconds
        renderTemplatePreview(seconds)
      }
    } else {
      if (!preview.last) preview.last = now
      const delta = Math.min(0.12, (now - preview.last) / 1000)
      preview.last = now
      if (preview.playing) {
        preview.time += delta
        if (preview.time >= preview.total) preview.time = 0
      }
      renderTemplatePreview(preview.time)
    }
    preview.raf = requestAnimationFrame(loop)
  }
  state.preview.raf = requestAnimationFrame(loop)
}

function stopTemplatePreviewLoop() {
  if (state.preview.raf) cancelAnimationFrame(state.preview.raf)
  state.preview.raf = null
}

function stopTemplatePreview(close = true) {
  stopTemplatePreviewLoop()
  const preview = state.preview
  if (preview.handle && window.NutCutRemotion) {
    try { window.NutCutRemotion.unmount($('#preview-remotion')) } catch { /* already gone */ }
  }
  preview.handle = null
  const host = $('#preview-remotion')
  if (host) {
    host.hidden = true
    host.innerHTML = ''
  }
  state.preview.template = null
  state.preview.ready = false
  state.preview.inputs = null
  const iframe = $('#preview-frame')
  if (iframe) {
    iframe.onload = null
    iframe.dataset.previewToken = ''
    iframe.hidden = false
  }
  if (close) $('#template-preview').hidden = true
  requestAnimationFrame(() => {
    if (iframe && !state.preview.template) iframe.src = 'about:blank'
  })
}

/* ---------- 图片查看器 ---------- */
function openViewer(galleryName, index) {
  const list = state.galleries[galleryName] || []
  if (!list.length) return
  state.viewer = { gallery: galleryName, index: (index + list.length) % list.length }
  updateViewer()
  $('#lightbox').hidden = false
  document.body.style.overflow = 'hidden'
}
function updateViewer() {
  const list = state.galleries[state.viewer.gallery] || []
  const item = list[state.viewer.index]
  if (!item) return
  $('#lightbox-image').src = item.url
  $('#lightbox-image').alt = item.caption
  $('#lightbox-caption').textContent = `${item.caption} · ${state.viewer.index + 1}/${list.length}`
  $('#lightbox-open').href = item.url
  $('#lightbox-prev').disabled = list.length <= 1
  $('#lightbox-next').disabled = list.length <= 1
}
function closeViewer() {
  $('#lightbox').hidden = true
  $('#lightbox-image').removeAttribute('src')
  if ($('#view-project').hidden) document.body.style.overflow = ''
}
function stepViewer(delta) {
  const list = state.galleries[state.viewer.gallery] || []
  if (!list.length) return
  state.viewer.index = (state.viewer.index + delta + list.length) % list.length
  updateViewer()
}

/* ---------- 路由 ---------- */
function routeFromHash() {
  const match = /^#\/p\/([^/]+)(?:\/([a-z]+))?$/.exec(location.hash)
  if (match) {
    const tabs = PROJECT_TABS.map(([id]) => id)
    const tab = tabs.includes(match[2]) ? match[2] : 'overview'
    openProject(decodeURIComponent(match[1]), tab)
    return
  }
  const viewMatch = /^#\/([a-z]+)$/.exec(location.hash)
  const views = ['dashboard', 'projects', 'templates', 'voice', 'assets', 'system']
  if (viewMatch && views.includes(viewMatch[1])) {
    if (state.current) closeProject(false)
    switchView(viewMatch[1])
    return
  }
  if (state.current) {
    closeProject(false)
    switchView('projects')
  }
}
window.addEventListener('hashchange', routeFromHash)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#template-preview').hidden) { stopTemplatePreview(); return }
  if (event.key === 'Escape' && !$('#template-dialog').hidden) { $('#template-dialog').hidden = true; return }
  if (event.key === 'Escape' && !$('#lightbox').hidden) { closeViewer(); return }
})

bindNav()
bindAssets()
bindProject()
$('#template-form').addEventListener('submit', submitTemplateForm)
$('#template-dialog').addEventListener('click', (event) => {
  if (event.target.closest('[data-dialog-close]')) $('#template-dialog').hidden = true
})
$('#template-form').querySelector('[name="title"]').addEventListener('input', (event) => {
  const idInput = $('#template-form').querySelector('[name="id"]')
  if (idInput.dataset.touched === '1') return
  idInput.value = event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
})
$('#template-form').querySelector('[name="id"]').addEventListener('input', (event) => {
  event.target.dataset.touched = '1'
})
$('#template-preview').addEventListener('click', (event) => {
  if (event.target.closest('[data-preview-close]')) stopTemplatePreview()
})
$('#preview-play').addEventListener('click', () => {
  const preview = state.preview
  preview.playing = !preview.playing
  if (preview.engine === 'remotion' && preview.handle) {
    if (preview.playing) preview.handle.play()
    else preview.handle.pause()
  } else {
    preview.last = 0
  }
  $('#preview-play').textContent = preview.playing ? '暂停' : '播放'
})
$('#preview-restart').addEventListener('click', () => {
  const preview = state.preview
  preview.time = 0
  preview.playing = true
  preview.last = 0
  preview.lastFrame = null
  if (preview.engine === 'remotion' && preview.handle) {
    preview.handle.seekTo(0)
    preview.handle.play()
  }
  $('#preview-play').textContent = '暂停'
  renderTemplatePreview(0)
})
$('#preview-seek').addEventListener('input', (event) => {
  const preview = state.preview
  preview.time = Number(event.target.value)
  preview.last = 0
  preview.lastFrame = null
  if (preview.engine === 'remotion' && preview.handle) {
    preview.handle.seekTo(Math.round(preview.time * Number(preview.remotion.fps || 30)))
  }
  renderTemplatePreview(preview.time)
})
window.addEventListener('resize', () => {
  if (!$('#template-preview').hidden) {
    fitPreviewCard()
    fitTemplatePreview()
  }
})
loadAll().then(routeFromHash)
