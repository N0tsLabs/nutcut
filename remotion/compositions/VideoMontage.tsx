import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {clamp01, enter, mix, noise, typedLength} from '../lib/anim'
import {Placeholder} from '../components/Placeholder'
import type {ReelProps} from '../types'

type Shot = {
  caption: string
  tag: string
  type: 'full' | 'duo' | 'trio'
  side?: 'left' | 'right'
}

const SHOTS: Shot[] = [
  {caption: '先把人放出来', tag: 'OPEN', type: 'full'},
  {caption: '环境交代清楚就够', tag: 'WIDE', type: 'duo', side: 'left'},
  {caption: '动作要有一个起点', tag: 'ACTION', type: 'full'},
  {caption: '切近，看手上的细节', tag: 'DETAIL', type: 'trio'},
  {caption: '让表情接住情绪', tag: 'FACE', type: 'full'},
  {caption: '产品只出现一次', tag: 'OBJECT', type: 'duo', side: 'right'},
  {caption: '前后放在一起对比', tag: 'BEFORE', type: 'full'},
  {caption: '最后一帧留白', tag: 'OUTRO', type: 'trio'},
]

export const videoMontageDefaults: ReelProps = {
  kicker: 'VIDEO MONTAGE',
  title: '按节拍重剪',
}

export const VideoMontage: React.FC<ReelProps> = ({palette, kicker}) => {
  const frame = useCurrentFrame()
  const {durationInFrames, fps} = useVideoConfig()
  const theme = resolveTheme(palette)
  const per = durationInFrames / SHOTS.length
  const beat = Math.min(SHOTS.length - 1, Math.floor(frame / per))
  const local = frame - beat * per
  const shot = SHOTS[beat]
  const punch = 1 + (1 - clamp01(local / 7)) * 0.05
  const typed = typedLength(frame, beat * per, shot.caption.length, 1.6)

  const panelColor = (i: number) => shade(theme.background, theme.dark ? 0.08 + i * 0.05 : -0.05 - i * 0.04)
  const accentColor = shade(theme.accent, theme.dark ? -0.24 : -0.1)

  const renderPanel = (label: string, color: string, style: React.CSSProperties, active = true) => (
    <Placeholder
      kind="video"
      theme={theme}
      label={label}
      color={color}
      radius={12}
      labelSize={14}
      style={{
        position: 'absolute',
        border: `2px solid ${active ? theme.accent : alpha(theme.text, 0.14)}`,
        opacity: active ? 1 : 0.55,
        ...style,
      }}
    />
  )

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${punch})`, transformOrigin: 'center'}}>
        {shot.type === 'full' ? (
          renderPanel(`视频占位 · SHOT ${String(beat + 1).padStart(2, '0')}`, panelColor(0), {inset: 0, borderRadius: 0, border: 'none'})
        ) : null}

        {shot.type === 'duo' ? (
          <>
            {renderPanel('视频占位 A', panelColor(0), {left: shot.side === 'left' ? 0 : '38%', top: 0, width: '62%', height: '100%', borderRadius: 0})}
            {renderPanel('视频占位 B', accentColor, {left: shot.side === 'left' ? '62%' : 0, top: 0, width: '38%', height: '100%', borderRadius: 0}, false)}
          </>
        ) : null}

        {shot.type === 'trio' ? (
          <>
            {renderPanel('视频占位 A', panelColor(0), {left: 0, top: 0, width: '66%', height: '62%', borderRadius: 0})}
            {renderPanel('视频占位 B', accentColor, {left: '66%', top: 0, width: '34%', height: '62%', borderRadius: 0}, false)}
            {renderPanel('视频占位 C', panelColor(2), {left: 0, top: '62%', width: '100%', height: '38%', borderRadius: 0}, false)}
          </>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${alpha(theme.background, 0.72)} 0%, transparent 26%, transparent 56%, ${alpha(theme.background, 0.86)} 100%)`,
        }}
      />

      <div style={{position: 'absolute', left: 72, top: 64, display: 'flex', alignItems: 'baseline', gap: 20}}>
        <span style={{fontFamily: MONO, fontSize: 15, letterSpacing: '0.2em', color: theme.accent, fontWeight: 800}}>{kicker || 'VIDEO MONTAGE'}</span>
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.16em', color: alpha(theme.text, 0.55)}}>{shot.tag}</span>
      </div>

      <div style={{position: 'absolute', right: 72, top: 46, display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: MONO, fontSize: 88, lineHeight: 0.8, fontWeight: 900, letterSpacing: '-0.06em'}}>{String(beat + 1).padStart(2, '0')}</span>
        <span style={{fontFamily: MONO, fontSize: 14, letterSpacing: '0.16em', color: alpha(theme.text, 0.55)}}>/ 0{SHOTS.length}</span>
      </div>

      <div style={{position: 'absolute', left: 72, bottom: 236, maxWidth: 1180}}>
        <div style={{fontSize: 62, lineHeight: 1.08, fontWeight: 900, letterSpacing: '-0.05em'}}>
          {shot.caption.slice(0, typed)}
          <span style={{color: theme.accent}}>{typed >= shot.caption.length ? '' : '▌'}</span>
        </div>
        <div style={{marginTop: 14, display: 'flex', gap: 10}}>
          {['原声', '30FPS', '无转场硬切'].map((tag) => (
            <span key={tag} style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: alpha(theme.text, 0.5), border: `1px solid ${theme.line}`, borderRadius: 999, padding: '5px 10px'}}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 音轨波形 */}
      <div style={{position: 'absolute', left: 72, right: 72, bottom: 148, height: 58, display: 'flex', alignItems: 'center', gap: 3}}>
        {Array.from({length: 64}).map((_, i) => {
          const strength = 0.18 + noise(i * 3.7) * 0.82
          const pulse = 0.55 + 0.45 * Math.sin((frame / fps) * 5 + i * 0.42)
          const active = i / 64 <= frame / durationInFrames
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, 56 * strength * pulse),
                borderRadius: 2,
                background: active ? alpha(theme.accent, 0.9) : alpha(theme.text, 0.16),
              }}
            />
          )
        })}
      </div>

      {/* 剪辑时间线 */}
      <div style={{position: 'absolute', left: 72, right: 72, bottom: 64, display: 'flex', alignItems: 'center', gap: 8}}>
        {SHOTS.map((item, i) => (
          <div key={item.tag + i} style={{flex: 1}}>
            <div
              style={{
                height: i === beat ? 10 : 4,
                borderRadius: 2,
                background: i === beat ? theme.accent : alpha(theme.text, 0.2),
              }}
            />
            <div style={{marginTop: 8, fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: i === beat ? theme.text : alpha(theme.text, 0.34)}}>
              {item.tag}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
