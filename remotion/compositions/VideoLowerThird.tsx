import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {ENTER, enter, fadeIn, mix, morphProgress, sceneAt, sceneOpacity} from '../lib/anim'
import {Placeholder, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const CHAPTERS = [
  {title: '先把人放出来', note: '下三分之一补充信息，不挡主体。'},
  {title: '把名字说清楚', note: '标题只出现一次，别让字幕抢戏。'},
  {title: '给画面留空间', note: '重要动作发生在上半部分。'},
  {title: '最后收住', note: '下三分之一退场，让画面自己结束。'},
]

export const videoLowerThirdDefaults: ReelProps = {
  kicker: 'VIDEO LOWER THIRD',
  title: '先把人放出来',
  chapters: CHAPTERS,
}

export const VideoLowerThird: React.FC<ReelProps> = ({palette, kicker, chapters = CHAPTERS}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const count = chapters.length
  const per = durationInFrames / count
  const scene = sceneAt(frame, count, per)
  const index = Math.min(count - 1, scene.index)
  const local = frame - index * per
  const reveal = enter(local, 0, 20)
  const morph = morphProgress(frame, index, per, 18)
  const active = chapters[index]

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text, overflow: 'hidden'}}>
      <Placeholder
        kind="video"
        theme={theme}
        label="视频占位"
        color={shade(theme.background, theme.dark ? 0.1 : -0.06)}
        radius={0}
        labelSize={16}
        style={{position: 'absolute', inset: 0}}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${alpha(theme.background, 0.66)} 0%, transparent 30%, transparent 52%, ${alpha(theme.background, 0.82)} 84%, ${alpha(theme.background, 0.96)} 100%)`,
        }}
      />

      <div style={{position: 'absolute', left: 96, right: 96, top: 62, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{width: 9, height: 9, borderRadius: '50%', background: theme.accent}} />
          <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', color: alpha(theme.text, 0.8), fontWeight: 800}}>{kicker || 'VIDEO LOWER THIRD'}</span>
        </div>
        <div style={{display: 'flex', gap: 22, fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: alpha(theme.text, 0.6)}}>
          <span>REC · 30FPS</span>
          <span>
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 下三分之一 */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 176,
          maxWidth: 1120,
          display: 'flex',
          gap: 26,
          opacity: fadeIn(frame, 0, 12) * 0.55 + reveal * 0.45,
          transform: `translateX(${mix(-52, 0, reveal)}px)`,
        }}
      >
        <div style={{width: 5, background: theme.accent, borderRadius: 3, transformOrigin: 'top', transform: `scaleY(${reveal})`}} />
        <div>
          <div style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.22em', color: theme.accent, fontWeight: 800}}>CHAPTER {String(index + 1).padStart(2, '0')}</div>
          <div style={{marginTop: 14, height: 84, overflow: 'hidden', position: 'relative'}}>
            {chapters.map((chapter, i) => (
              <div
                key={chapter.title + i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  fontSize: 68,
                  lineHeight: 1.08,
                  fontWeight: 900,
                  letterSpacing: '-0.05em',
                  opacity: sceneOpacity(frame, i, count, per, 10),
                  transform: `translateY(${mix(56, 0, enter(frame - i * per, 0, 22))}px)`,
                }}
              >
                {chapter.title}
              </div>
            ))}
          </div>
          <div style={{marginTop: 12, fontSize: 23, lineHeight: 1.5, color: alpha(theme.text, 0.72), maxWidth: 760}}>{active.note}</div>
          <div style={{marginTop: 24, display: 'flex', alignItems: 'center', gap: 16}}>
            <Progress frame={frame} duration={durationInFrames} theme={theme} width={260} />
            <span style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: alpha(theme.text, 0.5)}}>LOWER THIRD / 2026</span>
          </div>
        </div>
      </div>

      {/* 右侧章节进度 */}
      <div style={{position: 'absolute', right: 96, top: 250, width: 262}}>
        <div style={{position: 'absolute', left: 0, top: 4, bottom: 4, width: 2, background: alpha(theme.text, 0.14)}} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 2,
            top: mix((Math.max(0, index - 1) / count) * 100, (index / count) * 100, morph),
            height: `${100 / count}%`,
            background: theme.accent,
          }}
        />
        <div style={{display: 'grid', gap: 22, paddingLeft: 18}}>
          {chapters.map((chapter, i) => (
            <div key={chapter.title + 'side'} style={{opacity: i === index ? 1 : 0.4}}>
              <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: i === index ? theme.accent : alpha(theme.text, 0.5)}}>
                CH {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{marginTop: 5, fontSize: i === index ? 20 : 17, fontWeight: 800, color: i === index ? theme.text : alpha(theme.text, 0.6)}}>{chapter.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{position: 'absolute', left: 96, right: 96, bottom: 58, display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: alpha(theme.text, 0.45)}}>
        <span>{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')} · 10 SEC</span>
        <span>SOURCE / 1920 ? 1080</span>
      </div>
    </AbsoluteFill>
  )
}
