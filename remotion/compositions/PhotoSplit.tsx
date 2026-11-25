import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {ENTER, enter, mix, sceneAt, sceneOpacity} from '../lib/anim'
import {Placeholder, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const SCENES = [
  {quote: '上下两张图，讲一个对比', body: '让两张图片各自承担一半信息，不用抢。'},
  {quote: '上面是环境，下面是细节', body: '观众先看整体，再被一个细节抓住。'},
  {quote: '分屏不是把画面切碎', body: '是让两张图产生关系。'},
  {quote: '最后让一张图收住', body: '另一张退到背景，别平均用力。'},
]

export const photoSplitDefaults: ReelProps = {
  kicker: 'PHOTO SPLIT',
  title: '上下两张图，讲一个对比',
}

export const PhotoSplit: React.FC<ReelProps> = ({palette, kicker}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const per = durationInFrames / SCENES.length
  const scene = sceneAt(frame, SCENES.length, per)
  const index = scene.index
  const local = frame - index * per
  const reveal = enter(local, 0, 22)

  const topColor = shade(theme.background, theme.dark ? 0.18 : -0.12)
  const bottomColor = shade(theme.accent, theme.dark ? -0.3 : -0.16)

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          left: -40,
          right: -40,
          top: 0,
          height: 1120,
          clipPath: 'polygon(0 0, 100% 0, 100% 76%, 0 92%)',
          transform: `translateX(${mix(-34, 0, reveal)}px)`,
        }}
      >
        <Placeholder kind="photo" theme={theme} label="图片占位 01" color={topColor} radius={0} style={{position: 'absolute', inset: 0}} />
        <div style={{position: 'absolute', left: 84, top: 96, fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', color: alpha(theme.text, 0.6)}}>
          {'PHOTO SPLIT'} / 0{index + 1}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          left: -40,
          right: -40,
          bottom: 0,
          height: 1120,
          clipPath: 'polygon(0 26%, 100% 8%, 100% 100%, 0 100%)',
          transform: `translateX(${mix(34, 0, reveal)}px)`,
        }}
      >
        <Placeholder kind="photo" theme={theme} label="图片占位 02" color={bottomColor} radius={0} style={{position: 'absolute', inset: 0}} />
        <div style={{position: 'absolute', right: 84, bottom: 96, fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.65)'}}>
          {String(index + 1).padStart(2, '0')} / 0{SCENES.length}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: -60,
          right: -60,
          top: 1006,
          zIndex: 2,
          height: 4,
          background: theme.accent,
          transform: 'rotate(-3.4deg)',
          boxShadow: `0 0 32px ${alpha(theme.accent, 0.5)}`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 92,
          right: 92,
          top: 676,
          height: 520,
          background: shade(theme.surface, theme.dark ? 0.03 : 0.02),
          border: `1px solid ${theme.line}`,
          borderRadius: 22,
          boxShadow: theme.shadow,
          zIndex: 5,
          padding: '52px 54px',
          transform: `translateY(${mix(28, 0, reveal)}px) scale(${mix(0.985, 1, reveal)})`,
        }}
      >
        <div style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.22em', color: theme.accent, fontWeight: 800}}>PHOTO SPLIT / 0{index + 1}</div>
        <div key={index} style={{position: 'relative', marginTop: 26, height: 220}}>
          <div style={{fontSize: 72, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-0.055em', opacity: reveal, transform: `translateY(${mix(20, 0, reveal)}px)`}}>{SCENES[index].quote}</div>
          <div style={{marginTop: 18, fontSize: 25, lineHeight: 1.55, color: theme.muted, opacity: enter(local, 6, 20)}}>{SCENES[index].body}</div>
        </div>
        <div style={{marginTop: 26, display: 'flex', alignItems: 'center', gap: 14}}>
          <div style={{width: 46 + index * 12, height: 3, background: theme.accent, borderRadius: 2}} />
          <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: alpha(theme.text, 0.45)}}>
            {String(index + 1).padStart(2, '0')} / 0{SCENES.length}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 54,
            right: 54,
            bottom: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${theme.line}`,
            paddingTop: 16,
          }}
        >
          <div style={{display: 'flex', gap: 8}}>
            {['A · 环境', 'B · 细节', '对比'].map((tag) => (
              <span key={tag} style={{border: `1px solid ${theme.line}`, borderRadius: 999, padding: '5px 11px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: alpha(theme.text, 0.5)}}>
                {tag}
              </span>
            ))}
          </div>
          <span style={{fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: alpha(theme.text, 0.4)}}>BEFORE / AFTER</span>
        </div>
      </div>

      <div style={{position: 'absolute', left: 92, right: 92, bottom: 76, display: 'flex', alignItems: 'center', gap: 16}}>
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.55)}}>
          {kicker || 'PHOTO SPLIT'}
        </span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.55)}}>10 SEC</span>
      </div>
    </AbsoluteFill>
  )
}
