import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {EASE, ENTER, enter, mix, morphProgress, sceneAt, sceneOpacity} from '../lib/anim'
import {Glow, Grid, Placeholder, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const CHAPTERS = [
  {title: '先给结论', note: '观众只想知道这一页要说什么，别铺垫太久。', keyword: '结论先行'},
  {title: '再讲原因', note: '一句话解释动机，剩下的交给画面。', keyword: '一句原因'},
  {title: '给个例子', note: '具体场景比抽象概念更容易被记住。', keyword: '具体场景'},
  {title: '最后收住', note: '用一个动作结束，不要把话说满。', keyword: '留白收尾'},
]

const CAPTIONS = [
  '画面可以很小，但说的话要清楚。',
  '先讲结论，再补一句为什么。',
  '举一个你真正见过的例子。',
  '最后停半拍，把情绪收住。',
]

const LAYOUTS = [
  {x: 96, y: 304, w: 888, h: 660},
  {x: 72, y: 330, w: 520, h: 700},
  {x: 488, y: 330, w: 520, h: 700},
  {x: 96, y: 276, w: 888, h: 748},
]

export const talkFrameDefaults: ReelProps = {
  kicker: 'TALK FRAME',
  title: '口播画中画',
  subtitle: '视频是页面里的一个元素',
  chapters: CHAPTERS,
  captions: CAPTIONS,
}

export const TalkFrame: React.FC<ReelProps> = ({palette, kicker, title, chapters = CHAPTERS, captions = CAPTIONS}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const count = chapters.length
  const per = durationInFrames / count
  const scene = sceneAt(frame, count, per)
  const index = Math.min(count - 1, scene.index)
  const morph = morphProgress(frame, index, per, 22)

  const current = LAYOUTS[index] || LAYOUTS[0]
  const previous = LAYOUTS[Math.max(0, index - 1)] || current
  const box = {
    x: mix(previous.x, current.x, morph),
    y: mix(previous.y, current.y, morph),
    w: mix(previous.w, current.w, morph),
    h: mix(previous.h, current.h, morph),
  }

  const railOnLeft = index === 2
  const railX = railOnLeft ? 72 : 620
  const railWidth = 388
  const showRail = index === 1 || index === 2
  const railEnter = showRail ? Math.max(0, Math.min(1, (box.w < 700 ? morph : 0))) : 0

  const active = chapters[index] || CHAPTERS[0]

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 80% at 84% 4%, ${alpha(theme.accent, theme.dark ? 0.2 : 0.16)}, transparent 58%), radial-gradient(90% 60% at 4% 96%, ${alpha(theme.surface, theme.dark ? 0.55 : 0.9)}, transparent 60%)`,
        }}
      />
      <Grid theme={theme} size={108} opacity={0.55} />
      <Glow theme={theme} x={930} y={180} size={620} opacity={0.35} />
      <Glow theme={theme} x={110} y={1660} size={520} opacity={0.22} color={theme.primary} />

      <div style={{position: 'absolute', left: 72, top: 76, right: 72, display: 'flex', justifyContent: 'space-between'}}>
        <div>
          <div style={{fontFamily: MONO, fontSize: 15, letterSpacing: '0.24em', color: theme.accent, fontWeight: 800}}>
            {(kicker || 'TALK FRAME')} / {String(index + 1).padStart(2, '0')}
          </div>
          <div style={{position: 'relative', height: 82, width: 720, marginTop: 16, overflow: 'hidden'}}>
            {chapters.map((chapter, i) => {
              const local = frame - i * per
              const reveal = enter(local, 0, 22)
              const opacity = sceneOpacity(frame, i, count, per, 10)
              return (
                <div
                  key={chapter.title + i}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity,
                    transform: `translateY(${mix(26, 0, reveal)}px)`,
                    fontSize: 62,
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
          <div style={{marginTop: 12, fontSize: 20, color: theme.muted}}>{title || '口播画中画'} · 原声保留</div>
        </div>
        <div style={{fontFamily: MONO, fontSize: 116, lineHeight: 0.78, fontWeight: 900, color: alpha(theme.text, 0.08), letterSpacing: '-0.08em'}}>
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>

      {/* 视频窗口：随章节连续位移/缩放，不做硬切 */}
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          transform: `scale(${mix(0.97, 1, morph)})`,
          transformOrigin: 'center',
        }}
      >
        <Placeholder
          kind="video"
          theme={theme}
          label="视频占位"
          radius={28}
          style={{width: '100%', height: '100%', boxShadow: theme.shadow, border: `1px solid ${alpha(theme.text, 0.14)}`}}
        />
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 20,
            padding: '8px 14px',
            borderRadius: 999,
            background: theme.accent,
            color: theme.dark ? '#141414' : '#fff',
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.14em',
          }}
        >
          0{index + 1} / 0{count}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            padding: '9px 16px',
            borderRadius: 12,
            background: alpha(theme.background, 0.82),
            border: `1px solid ${alpha(theme.text, 0.16)}`,
            color: theme.text,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          {active.keyword}
        </div>
      </div>

      {/* 窄窗口时，另一侧补关键词和注释，避免空白 */}
      {showRail ? (
        <div
          style={{
            position: 'absolute',
            left: railX,
            top: 348,
            width: railWidth,
            opacity: railEnter,
            transform: `translateX(${mix(railOnLeft ? -18 : 18, 0, railEnter)}px)`,
          }}
        >
          <div style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.22em', color: theme.accent, fontWeight: 800}}>KEYWORD</div>
          <div style={{marginTop: 10, fontSize: 34, fontWeight: 900, lineHeight: 1.16, letterSpacing: '-0.03em'}}>{active.keyword}</div>
          <div style={{marginTop: 18, height: 1, background: theme.line}} />
          <div style={{marginTop: 18, fontSize: 20, lineHeight: 1.62, color: theme.muted}}>{active.note}</div>
          <div style={{marginTop: 28, display: 'grid', gap: 10}}>
            {chapters.map((chapter, i) => (
              <div
                key={chapter.title + 'rail'}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  paddingTop: 8,
                  borderTop: `1px solid ${i === index ? theme.accent : theme.line}`,
                  color: i === index ? theme.text : alpha(theme.text, 0.42),
                  fontFamily: MONO,
                  fontSize: 12,
                  letterSpacing: '0.1em',
                }}
              >
                <b style={{color: i === index ? theme.accent : 'inherit'}}>{String(i + 1).padStart(2, '0')}</b>
                <span style={{fontFamily: FONT, fontSize: 15, fontWeight: 700}}>{chapter.title}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 430,
              fontFamily: MONO,
              fontSize: 176,
              lineHeight: 0.8,
              fontWeight: 900,
              letterSpacing: '-0.08em',
              color: alpha(theme.text, 0.06),
              pointerEvents: 'none',
            }}
          >
            0{index + 1}
          </div>
          <div style={{position: 'absolute', left: 0, top: 594, fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: alpha(theme.text, 0.38)}}>
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')} · 本章
          </div>
        </div>
      ) : null}

      {/* 章节条 */}
      <div style={{position: 'absolute', left: 72, right: 72, top: 1064, display: 'flex', gap: 10}}>
        {chapters.map((chapter, i) => (
          <div
            key={chapter.title + 'chip'}
            style={{
              flex: 1,
              padding: '14px 14px 16px',
              borderRadius: 14,
              border: `1px solid ${i === index ? theme.accent : theme.line}`,
              background: i === index ? alpha(theme.accent, theme.dark ? 0.16 : 0.1) : alpha(theme.surface, theme.dark ? 0.5 : 0.7),
            }}
          >
            <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: i === index ? theme.accent : alpha(theme.text, 0.42)}}>
              CH {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{marginTop: 6, fontSize: 18, fontWeight: 800, color: i === index ? theme.text : alpha(theme.text, 0.6)}}>
              {chapter.title}
            </div>
          </div>
        ))}
      </div>

      {/* 字幕：每个场景一层，交叉淡化；不遮挡视频 */}
      <div style={{position: 'absolute', left: 72, right: 72, top: 1206, height: 292}}>
        {captions.map((text, i) => {
          const local = frame - i * per
          const reveal = enter(local, 0, 18)
          const opacity = sceneOpacity(frame, i, count, per, 10) * reveal
          return (
            <div
              key={text + i}
              style={{
                position: 'absolute',
                inset: 0,
                opacity,
                transform: `translateY(${mix(22, 0, reveal)}px)`,
                background: alpha(theme.surface, theme.dark ? 0.86 : 0.92),
                border: `1px solid ${theme.line}`,
                borderRadius: 24,
                padding: '44px 46px 40px 58px',
                boxShadow: theme.shadow,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{position: 'absolute', left: 26, top: 46, bottom: 46, width: 5, borderRadius: 3, background: theme.accent}} />
              <div style={{fontSize: 42, lineHeight: 1.46, fontWeight: 800, letterSpacing: '-0.02em'}}>{text}</div>
            </div>
          )
        })}
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, top: 1548, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{maxWidth: 620, fontSize: 20, lineHeight: 1.62, color: theme.muted}}>{active.note}</div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: alpha(theme.text, 0.4)}}>TIMECODE</div>
          <div style={{fontFamily: MONO, fontSize: 22, fontWeight: 800, color: theme.text, marginTop: 4}}>
            00:{String(Math.floor(frame / 30)).padStart(2, '0')}.{String(Math.floor((frame % 30) / 3)).padStart(1, '0')}
          </div>
        </div>
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, top: 1646, display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        {['原声保留', '字幕 ≥ 32px', `章节 ${String(count).padStart(2, '0')}`, '无 Logo'].map((tag) => (
          <span
            key={tag}
            style={{
              border: `1px solid ${theme.line}`,
              borderRadius: 999,
              padding: '7px 14px',
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.12em',
              color: alpha(theme.text, 0.55),
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, top: 1724, display: 'flex', gap: 6}}>
        {chapters.map((chapter, i) => (
          <div key={chapter.title + 'bar'} style={{flex: 1, height: 6, borderRadius: 3, background: i === index ? theme.accent : alpha(theme.text, 0.12)}} />
        ))}
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, bottom: 64, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.55)}}>
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.55)}}>10 SEC</span>
      </div>
    </AbsoluteFill>
  )
}
