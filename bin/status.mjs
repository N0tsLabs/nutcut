#!/usr/bin/env node
/**
 * 项目状态检查，给 Agent 和用户看的下一步建议。
 *
 *   node bin/status.mjs --project projects/<id>
 *   node bin/status.mjs --project projects/<id> --json
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) { return process.argv.includes(`--${name}`) }
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function exists(file) { return fs.existsSync(file) }
function rel(file) { return path.relative(process.cwd(), file).replace(/\\/g, '/') }

const STAGE_ZH = { spec: '规格', intake: '素材接收', idea: '选题', script: '文案', voice: '声音', timeline: '时间线', visual: '画面', mix: '混音', render: '导出', review: '审阅' }

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/status.mjs --project projects/<id> [--json]')
  const projectDir = path.resolve(projectArg)
  const project = readJson(path.join(projectDir, 'project.json'))
  if (!project) throw new Error(`缺少 project.json：${projectDir}`)

  const script = readJson(path.join(projectDir, 'script.json'))
  const brief = readJson(path.join(projectDir, 'brief.json'))
  const issues = readJson(path.join(projectDir, 'issues.json'), { text: '', updatedAt: null })
  const imports = readJson(path.join(projectDir, 'imports.json'), [])
  const templateId = project.template || script?.template || null
  const template = templateId ? readJson(path.join('templates', templateId, 'template.json')) : null
  const outDir = path.join('out', project.id)
  const timing = readJson(path.join(outDir, 'timing.json'))
  const vo = readJson(path.join(outDir, 'vo', 'vo.json'))
  const issueText = String(issues?.text || '').trim()
  const usesSourceVoice = /source/i.test(String(project.voiceProfile || '')) || project.voiceMode === 'source'
  const sceneCount = timing?.scenes?.length || project.scenes?.length || 0
  const next = []

  if (!project.spec) next.push('视频规格未确认：先问用户横屏/竖屏/方形、尺寸、帧率、时长、平台，再写进 project.json 的 spec。')
  if (project.spec?.confirmed && project.layoutAdapted === false) next.push('模板版式还没按目标规格适配：改 src/index.html 后跑 node bin/adapt-layout.mjs --project <项目> --confirm。')
  if ((project.kind === 'video-frame' || project.kind === 'video-remix') && (!project.assets?.source || !exists(project.assets.source))) {
    next.push('缺少原始视频：交接时把 assets/imported 里的源文件一起带上，或用 node bin/import.mjs 重新导入。')
  }
  if (!imports.length && !brief) next.push('先确认用户是否提供素材；如果有，用 node bin/import.mjs 导入并分析。')
  const importsAnalyzed = imports.filter((item) => item.analysis).length
  if (imports.length && importsAnalyzed < imports.length) next.push(`还有 ${imports.length - importsAnalyzed} 个导入素材没有分析，先补 imports.json 的 analysis。`)
  if (!brief) next.push('写 projects/<id>/brief.json：主题、受众、角度、可行性、图片计划。')
  else if (!brief.feasibility || brief.feasibility.decision === 'pending' || brief.feasibility.decision == null) next.push('brief.json 的可行性结论还没定，先让用户确认 go / pause / drop。')
  if (!script?.lines?.length) next.push('写 script.json 的逐句文案，等用户确认。')
  if (script?.lines?.length && !vo?.lines?.length && !usesSourceVoice) next.push('运行 node bin/voice.mjs --project <项目> 生成声音。')
  if (!usesSourceVoice && vo?.lines?.length && !timing?.scenes?.length) next.push('运行 node bin/timeline.mjs --project <项目> 计算时间线。')
  if (sceneCount && !exists(path.join(outDir, 'mix.wav')) && !project.assets?.audio) next.push('选 BGM / 音效，运行 node bin/audio-mix.mjs --project <项目>。')
  if (!exists(path.join(outDir, 'film.mp4'))) next.push('运行 node bin/produce.mjs --project <项目> 导出成片。')
  if (issueText) next.push('先处理 projects/<id>/issues.json 里的问题记录。')

  const result = {
    ok: true,
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      stage: project.stage,
      stageLabel: STAGE_ZH[project.stage] || project.stage,
      duration: project.duration,
      spec: project.spec || null,
      layoutAdapted: project.layoutAdapted ?? null,
      template: template ? { id: template.id, name: template.name, category: template.category } : templateId,
    },
    progress: (project.pipeline || []).map((step) => ({ id: step.id, label: step.label, status: step.status })),
    brief: brief ? {
      exists: true,
      topic: brief.topic || '',
      audience: brief.audience || '',
      score: brief.feasibility?.score ?? null,
      decision: brief.feasibility?.decision || 'pending',
      risks: brief.feasibility?.risks || [],
      imagePlan: brief.imagePlan || [],
    } : { exists: false },
    script: script ? { exists: true, lines: script.lines?.length || 0 } : { exists: false, lines: 0 },
    voice: usesSourceVoice ? { exists: true, mode: 'source', lines: 0 } : vo?.lines?.length ? { exists: true, lines: vo.lines.length } : { exists: false, lines: 0 },
    timeline: sceneCount ? { exists: true, scenes: sceneCount, duration: timing?.duration || project.duration } : { exists: false, scenes: 0 },
    assets: {
      film: exists(path.join(outDir, 'film.mp4')),
      mix: exists(path.join(outDir, 'mix.wav')),
      poster: exists(path.join(outDir, 'poster.png')),
      bgm: exists(path.join(outDir, 'bgm.mp3')) || exists(path.join(outDir, 'bgm.wav')),
      sfx: exists(path.join(outDir, 'sfx')),
    },
    imports: {
      count: imports.length,
      analyzed: imports.filter((item) => item.analysis).length,
      files: imports.map((item) => ({ name: item.name, file: item.file, analysis: item.analysis || null })),
    },
    issues: {
      text: issueText,
      updatedAt: issues?.updatedAt || null,
    },
    next,
  }

  if (has('json')) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(`\n${project.title}  (${project.id})`)
  console.log(`状态：${project.status} · 阶段：${result.project.stageLabel} · 时长：${Number(project.duration || 0).toFixed(1)} 秒`)
  console.log(`规格：${project.spec ? `${project.spec.orientationLabel || project.spec.orientation} ${project.spec.width}×${project.spec.height} · ${project.spec.fps}fps${project.spec.platform ? ` · ${project.spec.platform}` : ''}` : '未确认（先问用户横竖屏、尺寸、帧率、时长）'}${project.layoutAdapted === false ? ' · 版式待适配' : ''}`)
  if (template) console.log(`模板：${template.name}（${template.category}）`)
  console.log(`\n进度：${(project.pipeline || []).map((step) => `${step.label}${step.status === 'done' ? '✓' : step.status === 'doing' ? '…' : '·'}`).join('  ')}`)
  console.log(`素材：${imports.length} 个导入，${result.imports.analyzed} 个已分析`)
  console.log(`文案：${script?.lines?.length || 0} 句 · 声音：${usesSourceVoice ? '原声' : `${vo?.lines?.length || 0} 句`} · 时间线：${sceneCount} 场`)
  console.log(`问题记录：${issueText ? '有' : '无'}${issueText ? ` · 更新 ${issues?.updatedAt || '—'}` : ''}`)
  if (issueText) {
    for (const line of issueText.split('\n').filter(Boolean).slice(0, 8)) console.log(`  - ${line.replace(/^[-*]\s*/, '')}`)
  }
  console.log('\n下一步：')
  if (next.length) for (const item of next) console.log(`  - ${item}`)
  else console.log('  - 没有明显缺口，可以进入审阅或交付。')
  console.log('')
}

main()
