import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {enter, mix, sceneAt, sceneOpacity} from '../lib/anim'
import {Placeholder, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const SCENES = [
  {kicker: 'PHOTO STORY / 01', title: '一张图，先让人停下来', body: '先给整体，再让观众自己找细节。', color: 0},
  {kicker: 'PHOTO STORY / 02', title: '细节要有一个焦点', body: '画面里只留一个值得看的地方。', color: 1},
  {kicker: 'PHOTO STORY / 03', title: '让图片和文字互相解释', body: '文字点题，图片负责情绪。', color: 2},
  {kicker: 'PHOTO STORY / 04', title: '最后留一点空白', body: '不要把每一寸都填满。', color: 3},
]

export const photoStoryDefaults: ReelProps = {
  kicker: 'PHOTO STORY',
  title: '一张图，一句记得住的话',
}

export const PhotoStory: React.FC<ReelProps> = ({palette, title}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const per = durationInFrames / SCENES.length
  const scene = sceneAt(frame, SCENES.length, per)
  const index = scene.index

  const colors = [
    shade(theme.background, theme.dark ? 0.16 : -0.1),
    shade(theme.accent, theme.dark ? -0.28 : -0.22),
    shade(theme.surface, theme.dark ? 0.14 : -0.06),
    shade(theme.primary, theme.dark ? -0.2 : -0.44),
  ]

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text, overflow: 'hidden'}}>
      {SCENES.map((item, i) => {
        const local = frame - i * per
        const opacity = sceneOpacity(frame, i, SCENES.length, per, 14)
        const zoom = 1.04 + Math.min(1, Math.max(0, local / per)) * 0.08
        return (
          <AbsoluteFill key={item.title} style={{opacity}}>
            <Placeholder
              kind="photo"
              theme={theme}
              label={`图片占位 0${i + 1}`}
              color={colors[item.color]}
              radius={0}
              labelSize={16}
              style={{position: 'absolute', inset: 0, transform: `scale(${zoom})`}}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(180deg, ${alpha(theme.background, 0.55)} 0%, ${alpha(theme.background, 0.05)} 34%, ${alpha(theme.background, 0.16)} 52%, ${alpha(theme.background, 0.94)} 82%, ${theme.background} 100%)`,
              }}
            />
          </AbsoluteFill>
        )
      })}

      <div style={{position: 'absolute', left: 84, right: 84, top: 92, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{fontFamily: MONO, fontSize: 15, letterSpacing: '0.2em', color: theme.accent, fontWeight: 800}}>
          {SCENES[index].kicker}
        </div>
        <div style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.16em', color: alpha(theme.text, 0.6)}}>
          {String(index + 1).padStart(2, '0')} / 0{SCENES.length}
        </div>
      </div>

      {/* 右侧缩略图：当前图片高亮 */}
      <div style={{position: 'absolute', right: 56, top: 300, display: 'grid', gap: 12}}>
        {SCENES.map((item, i) => (
          <div
            key={item.title + 'thumb'}
            style={{
              width: 76,
              height: 96,
              borderRadius: 8,
              background: colors[item.color],
              border: `2px solid ${i === index ? theme.accent : alpha(theme.text, 0.22)}`,
              opacity: i === index ? 1 : 0.5,
              transform: `scale(${i === index ? 1 : 0.92})`,
            }}
          />
        ))}
      </div>

      <div style={{position: 'absolute', left: 84, right: 84, bottom: 300}}>
        {SCENES.map((item, i) => {
          const local = frame - i * per
          const reveal = enter(local, 0, 24)
          const opacity = sceneOpacity(frame, i, SCENES.length, per, 12)
          return (
            <div key={item.title + 'copy'} style={{position: 'absolute', left: 0, right: 0, bottom: 0, opacity}}>
              <div style={{fontSize: 86, lineHeight: 1.04, fontWeight: 900, letterSpacing: '-0.055em', transform: `translateY(${mix(30, 0, reveal)}px)`}}>
                {item.title}
              </div>
              <div style={{marginTop: 22, fontSize: 29, lineHeight: 1.55, color: alpha(theme.text, 0.72), maxWidth: 780, transform: `translateY(${mix(18, 0, reveal)}px)`}}>
                {item.body}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{position: 'absolute', left: 86, bottom: 186, fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: alpha(theme.text, 0.52)}}>
        {title || 'PHOTO STORY'} / 2026
      </div>

      <div style={{position: 'absolute', left: 84, right: 84, bottom: 84, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.55)}}>
          {String(index + 1).padStart(2, '0')} / 0{SCENES.length}
        </span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.55)}}>10 SEC</span>
      </div>
    </AbsoluteFill>
  )
}
