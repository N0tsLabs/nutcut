import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {EASE, enter, mix, sceneAt, sceneOpacity} from '../lib/anim'
import {Grid, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const SCENES = [
  {lines: ['让画面', '自己说话'], sub: '设计不是装饰，是让信息被看见。', tag: 'OPENING'},
  {lines: ['先给结构', '再给情绪'], sub: '观众先知道看什么，再决定要不要感动。', tag: 'STRUCTURE'},
  {lines: ['每一帧', '都要有理由'], sub: '动效服务于内容，不服务于炫技。', tag: 'MOTION'},
  {lines: ['最后停在', '一个动作上'], sub: '结尾不是结束，是下一步的开始。', tag: 'ENDING'},
]

export const kineticTitleDefaults: ReelProps = {
  kicker: 'KINETIC TITLE',
  title: '让画面自己说话',
}

export const KineticTitle: React.FC<ReelProps> = ({palette, kicker}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const per = durationInFrames / SCENES.length
  const scene = sceneAt(frame, SCENES.length, per)
  const index = scene.index
  const local = frame - index * per
  const reveal = enter(local, 0, 24)
  const lineTwo = enter(local, 6, 26)

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text, overflow: 'hidden'}}>
      <Grid theme={theme} size={110} opacity={0.5} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(80% 70% at 78% 18%, ${alpha(theme.accent, theme.dark ? 0.2 : 0.14)}, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -60,
          top: 0,
          width: 420,
          height: '100%',
          background: `linear-gradient(180deg, transparent, ${alpha(theme.accent, 0.14)} 40%, transparent)`,
          transform: `skewX(-8deg) translateX(${mix(60, 0, reveal)}px)`,
        }}
      />

      <div style={{position: 'absolute', left: 110, top: 86, right: 110, display: 'flex', justifyContent: 'space-between'}}>
        <div style={{fontFamily: MONO, fontSize: 14, letterSpacing: '0.24em', color: theme.accent, fontWeight: 800}}>
          {(kicker || 'KINETIC TITLE')} / 0{index + 1}
        </div>
        <div style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.2em', color: alpha(theme.text, 0.4)}}>{SCENES[index].tag}</div>
      </div>

      <div style={{position: 'absolute', left: 104, top: 322, right: 240}}>
        {[0, 1].map((lineIndex) => {
          const progress = lineIndex === 0 ? reveal : lineTwo
          return (
            <div key={lineIndex} style={{height: 168, overflow: 'hidden'}}>
              <div
                style={{
                  fontSize: 158,
                  lineHeight: 1.02,
                  fontWeight: 900,
                  letterSpacing: '-0.065em',
                  transform: `translateY(${mix(105, 0, progress)}%)`,
                  whiteSpace: 'nowrap',
                }}
              >
                {SCENES[index].lines[lineIndex]}
                {lineIndex === 1 ? <span style={{color: theme.accent}}>。</span> : null}
              </div>
            </div>
          )
        })}

        <div style={{marginTop: 30, display: 'flex', alignItems: 'center', gap: 22}}>
          <div style={{width: 120 * reveal, height: 4, background: theme.accent, borderRadius: 2}} />
          <div style={{fontSize: 26, lineHeight: 1.5, color: alpha(theme.text, 0.72), opacity: enter(local, 10, 24)}}>{SCENES[index].sub}</div>
        </div>
      </div>

      <div style={{position: 'absolute', right: 96, top: 384, display: 'grid', justifyItems: 'end', gap: 12}}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 96 + i * 54 + index * 10,
              height: 5,
              borderRadius: 3,
              background: i === index % 3 ? theme.accent : alpha(theme.text, 0.22),
            }}
          />
        ))}
        <div style={{marginTop: 22, fontFamily: MONO, fontSize: 118, lineHeight: 0.8, fontWeight: 900, color: alpha(theme.text, 0.07), letterSpacing: '-0.08em'}}>
          0{index + 1}
        </div>
      </div>

      <div style={{position: 'absolute', left: 110, bottom: 150, display: 'flex', gap: 28}}>
        {SCENES.map((item, i) => (
          <div key={item.tag} style={{display: 'flex', alignItems: 'center', gap: 8, opacity: i === index ? 1 : 0.35}}>
            <span style={{width: 6, height: 6, borderRadius: '50%', background: i === index ? theme.accent : alpha(theme.text, 0.4)}} />
            <span style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: i === index ? theme.text : alpha(theme.text, 0.5)}}>{item.tag}</span>
          </div>
        ))}
      </div>

      <div style={{position: 'absolute', left: 110, right: 110, bottom: 76, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.16em', color: alpha(theme.text, 0.45)}}>
          {String(index + 1).padStart(2, '0')} / 0{SCENES.length}
        </span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.16em', color: alpha(theme.text, 0.45)}}>1920 × 1080</span>
      </div>
    </AbsoluteFill>
  )
}
