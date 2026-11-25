import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {ENTER, enter, fadeIn, mix, morphProgress, sceneAt, sceneOpacity} from '../lib/anim'
import {Grid, Placeholder, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const CHAPTERS = [
  {title: '先给结论', note: '观众只需要知道这一页要说什么。', keyword: '一句话结论'},
  {title: '再讲原因', note: '一句话解释为什么，不要展开成论文。', keyword: '一句原因'},
  {title: '给个例子', note: '具体场景比抽象概念更容易被记住。', keyword: '具体案例'},
  {title: '最后收住', note: '用一个动作或一句短话结束。', keyword: '短句收尾'},
]

const CAPTIONS = ['先给结论，再解释原因。', '原因只讲一句，留时间给画面。', '例子要具体，最好有动作。', '最后收住，不要拖尾。']

export const talkRailDefaults: ReelProps = {
  kicker: 'TALK RAIL',
  title: '左边是结构，右边是人',
  chapters: CHAPTERS,
  captions: CAPTIONS,
}

export const TalkRail: React.FC<ReelProps> = ({palette, kicker, title, chapters = CHAPTERS, captions = CAPTIONS}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const count = chapters.length
  const per = durationInFrames / count
  const scene = sceneAt(frame, count, per)
  const index = Math.min(count - 1, scene.index)
  const morph = morphProgress(frame, index, per, 20)
  const active = chapters[index] || CHAPTERS[0]
  const slide = index === 0 ? 0 : mix(index - 1, index, morph)

  const railBg = theme.dark ? shade(theme.background, 0.06) : shade(theme.surface, -0.03)
  const stepTop = 426
  const stepGap = 108

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text}}>
      <Grid theme={theme} size={120} opacity={0.35} />

      {/* 左侧结构栏 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 400,
          background: railBg,
          borderRight: `1px solid ${theme.line}`,
        }}
      >
        <div style={{position: 'absolute', left: 54, top: 74, fontFamily: MONO, fontSize: 12, letterSpacing: '0.24em', color: theme.accent, fontWeight: 800}}>
          {(kicker || 'TALK RAIL')} / 01
        </div>
        <div
          style={{
            position: 'absolute',
            left: 52,
            top: 116,
            right: 44,
            fontSize: 46,
            lineHeight: 1.14,
            fontWeight: 900,
            letterSpacing: '-0.05em',
          }}
        >
          {title || '左边是结构，右边是人'}
        </div>

        {/* 章节进度线：随场景连续下滑 */}
        <div style={{position: 'absolute', left: 0, top: stepTop - 12, width: 4, height: count * stepGap - 12, background: alpha(theme.text, 0.08)}} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: stepTop - 12 + slide * stepGap,
            width: 4,
            height: stepGap - 22,
            background: theme.accent,
            borderRadius: 2,
            boxShadow: `0 0 24px ${alpha(theme.accent, 0.55)}`,
          }}
        />

        {chapters.map((chapter, i) => {
          const on = i === index
          return (
            <div key={chapter.title + i} style={{position: 'absolute', left: 40, right: 28, top: stepTop + i * stepGap}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
                <span style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', color: on ? theme.accent : alpha(theme.text, 0.36)}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{fontSize: on ? 23 : 20, fontWeight: 800, color: on ? theme.text : alpha(theme.text, 0.46)}}>{chapter.title}</span>
              </div>
              <div
                style={{
                  marginTop: 6,
                  marginLeft: 34,
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: alpha(theme.text, 0.42),
                  opacity: on ? 1 : 0.35,
                  maxHeight: on ? 48 : 22,
                  overflow: 'hidden',
                }}
              >
                {chapter.note}
              </div>
            </div>
          )
        })}

        <div style={{position: 'absolute', left: 54, bottom: 52, fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: alpha(theme.text, 0.4)}}>
          10 SEC / {String(count).padStart(2, '0')} CHAPTERS
        </div>
      </div>

      {/* 右侧：视频 + 大字 */}
      <div
        style={{
          position: 'absolute',
          left: 472,
          top: 84,
          width: 1104,
          height: 621,
          opacity: fadeIn(frame, 0, 16),
          transform: `translateX(${mix(34, 0, enter(frame, 0, 26))}px)`,
        }}
      >
        <Placeholder kind="video" theme={theme} label="视频占位" radius={18} style={{width: '100%', height: '100%', boxShadow: theme.shadow}} />
        <div style={{position: 'absolute', left: 18, top: 16, padding: '6px 12px', borderRadius: 8, background: alpha(theme.background, 0.7), fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: alpha(theme.text, 0.62)}}>
          SOURCE / 01
        </div>
      </div>

      <div style={{position: 'absolute', left: 472, top: 744, width: 800, fontFamily: MONO, fontSize: 12, letterSpacing: '0.22em', color: theme.accent, fontWeight: 800}}>
        CHAPTER {String(index + 1).padStart(2, '0')}
      </div>

      <div style={{position: 'absolute', left: 472, top: 776, width: 860, height: 180, overflow: 'hidden'}}>
        {chapters.map((chapter, i) => {
          const local = frame - i * per
          const reveal = enter(local, 0, 24)
          const opacity = sceneOpacity(frame, i, count, per, 10)
          return (
            <div
              key={chapter.title + 'big'}
              style={{
                position: 'absolute',
                inset: 0,
                opacity,
                transform: `translateY(${mix(96, 0, reveal)}%)`,
                fontSize: 72,
                lineHeight: 1.06,
                fontWeight: 900,
                letterSpacing: '-0.05em',
              }}
            >
              {chapter.title}
            </div>
          )
        })}
      </div>

      <div style={{position: 'absolute', left: 472, top: 968, width: 760, height: 46, overflow: 'hidden'}}>
        {captions.map((text, i) => {
          const opacity = sceneOpacity(frame, i, count, per, 10) * enter(frame - i * per, 0, 18)
          return (
            <div key={text + i} style={{position: 'absolute', inset: 0, opacity, fontSize: 22, lineHeight: 1.5, color: theme.muted}}>
              {text}
            </div>
          )
        })}
      </div>

      {/* 右侧关键词列 */}
      <div style={{position: 'absolute', left: 1636, top: 84, width: 212}}>
        <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', color: alpha(theme.text, 0.42)}}>KEYWORD</div>
        <div style={{marginTop: 10, fontSize: 26, fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.03em', color: theme.text}}>
          {active.keyword}
        </div>
        <div style={{marginTop: 18, height: 1, background: theme.line}} />
        <div style={{marginTop: 16, fontSize: 15, lineHeight: 1.6, color: alpha(theme.text, 0.5)}}>{active.note}</div>
        <div style={{marginTop: 26, display: 'grid', gap: 8}}>
          {['原声', '字幕', '章节'].map((tag) => (
            <div key={tag} style={{border: `1px solid ${theme.line}`, borderRadius: 999, padding: '7px 12px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: alpha(theme.text, 0.5)}}>
              {tag}
            </div>
          ))}
        </div>
        <div style={{marginTop: 30, display: 'grid'}}>
          {chapters.map((chapter, i) => (
            <div
              key={chapter.title + 'mini'}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                paddingTop: 9,
                borderTop: `1px solid ${i === index ? theme.accent : theme.line}`,
                color: i === index ? theme.text : alpha(theme.text, 0.42),
              }}
            >
              <span style={{fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em'}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontSize: 13, fontWeight: 700}}>{chapter.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{position: 'absolute', left: 472, right: 84, bottom: 62, display: 'flex', alignItems: 'center', gap: 16}}>
        <span style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', color: alpha(theme.text, 0.5)}}>{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', color: alpha(theme.text, 0.5)}}>10 SEC</span>
      </div>
    </AbsoluteFill>
  )
}
