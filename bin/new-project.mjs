#!/usr/bin/env node
/**
 * 用内置模板新建项目。
 *
 * 模板只决定风格和配色；横竖屏、尺寸、帧率、时长必须显式确认。
 *
 *   node bin/new-project.mjs --id my-video --title "我的视频" --template tech-neon \
 *     --orientation portrait --quality 1080p --fps 30 --duration 30 \
 *     --platform douyin --audio source
 *
 * 也可以用 --size 1080x1920 直接指定尺寸。
 * 不提供规格时脚本会拒绝创建，并列出必须先问用户的问题。
 */
import path from 'node:path'
import { createProject, ProjectCreateError } from '../src/project-create.mjs'
import { expectedSpecQuestions } from '../src/spec.mjs'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function main() {
  const id = String(arg('id', '')).trim().toLowerCase()
  const title = String(arg('title', '')).trim() || id
  const template = String(arg('template', 'tech-neon')).trim()

  try {
    const result = createProject({
      root: path.resolve('.'),
      id,
      title,
      template,
      spec: {
        orientation: arg('orientation'),
        size: arg('size'),
        quality: arg('quality'),
        width: arg('width'),
        height: arg('height'),
        fps: arg('fps', '30'),
        duration: arg('duration'),
        platform: arg('platform'),
        audio: arg('audio'),
      },
    })
    console.log(JSON.stringify({
      ok: true,
      project: `projects/${id}`,
      template,
      spec: result.spec,
      needsLayoutAdaptation: result.needsLayoutAdaptation,
      next: [
        `node bin/status.mjs --project projects/${id}`,
        ...(result.needsLayoutAdaptation ? [`node bin/adapt-layout.mjs --project projects/${id} --confirm`] : []),
      ],
    }, null, 2))
  } catch (error) {
    if (!(error instanceof ProjectCreateError)) throw error
    console.error(`\n[规格未确认] ${error.message}\n`)
    console.error('先问用户，确认后再创建项目：')
    for (const question of error.questions?.length ? error.questions : expectedSpecQuestions()) console.error(`  - ${question}`)
    console.error('\n示例：')
    console.error('  node bin/new-project.mjs --id my-video --title "我的视频" --template tech-neon \\')
    console.error('    --orientation portrait --quality 1080p --fps 30 --duration 30 --audio source')
    process.exit(1)
  }
}

main()
