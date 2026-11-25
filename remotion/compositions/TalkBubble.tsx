import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme} from '../lib/theme'
import {EASE, ENTER, enter, fadeIn, mix, sceneAt, sceneOpacity} from '../lib/anim'
import {Glow, Grid, Placeholder, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

type Scene = {
  title: string
  bubble: string
  cards: [string, string, string][]
}

const SCENES: Scene[] = [
  {
    title: '让头像说人话',
    bubble: '画面可以很小，但说的话要清楚。',
    cards: [
      ['01', '先讲结论', '一句话只做一件事。'],
      ['02', '再补细节', '用画面解释，不用堆字。'],
      ['03', '留点呼吸', '关键点停半拍。'],
      ['04', '收住情绪', '最后一句要记得住。'],
    ],
  },
  {
    title: '头像不是主角',
    bubble: '头像负责亲切，内容负责价值。',
    cards: [
      ['01', '位置固定', '不要每句话都移动。'],
      ['02', '尺寸克制', '角落里的表情就够了。'],
      ['03', '近景一次', '强调时再放大。'],
      ['04', '回到内容', '别让头像抢走注意力。'],
    ],
  },
  {
    title: '一句话一个画面',
    bubble: '观众记不住十件事，只记得住一句。',
    cards: [
      ['01', '删掉形容词', '留下动作和结果。'],
      ['02', '字幕短一点', '手机上要能一眼看完。'],
      ['03', '节奏慢一点', '重要信息多停一会儿。'],
      ['04', '结尾留白', '不要把话说满。'],
    ],
  },
  {
    title: '最后落到人',
    bubble: '技术只是工具，表达才是目的。',
    cards: [
      ['01', '说人话', '不用术语堆砌。'],
      ['02', '给例子', '一个具体场景胜过十个概念。'],
      ['03', '留温度', '让观众感觉你在跟他说话。'],
      ['04', '做收束', '用一个动作结束。'],
    ],
  },
]

export const talkBubbleDefaults: ReelProps = {
  kicker: 'TALK BUBBLE',
  title: SCENES[0].title,
}

export const TalkBubble: React.FC<ReelProps> = ({palette, kicker}) => {
  const frame = useCurrentFrame()
  const {durationInFrames} = useVideoConfig()
  const theme = resolveTheme(palette)
  const per = durationInFrames / SCENES.length
  const scene = sceneAt(frame, SCENES.length, per)
  const index = scene.index
  const data = SCENES[index]
  const local = frame - index * per

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text}}>
      <Grid theme={theme} size={90} opacity={0.5} />
      <Glow theme={theme} x={960} y={140} size={560} opacity={theme.dark ? 0.3 : 0.22} />
      <Glow theme={theme} x={90} y={1700} size={520} opacity={0.18} color={theme.primary} />

      <div style={{position: 'absolute', left: 84, right: 84, top: 84, display: 'flex', justifyContent: 'space-between'}}>
        <div>
          <div style={{fontFamily: MONO, fontSize: 15, letterSpacing: '0.22em', color: theme.accent, fontWeight: 800}}>
            {(kicker || 'TALK BUBBLE')} / {String(index + 1).padStart(2, '0')}
          </div>
          <div style={{marginTop: 18, fontSize: 78, lineHeight: 1.03, fontWeight: 900, letterSpacing: '-0.055em'}}>{data.title}</div>
        </div>
        <div style={{fontFamily: MONO, fontSize: 110, lineHeight: 0.82, fontWeight: 900, color: alpha(theme.text, 0.08), letterSpacing: '-0.08em'}}>
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>

      <div style={{position: 'absolute', left: 84, right: 84, top: 420, height: 760, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
        {data.cards.map((card, i) => {
          const delay = local - i * 5
          const reveal = enter(delay, 0, ENTER)
          return (
            <div
              key={card[1]}
              style={{
                border: `1px solid ${theme.line}`,
                background: alpha(theme.surface, theme.dark ? 0.8 : 0.82),
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 18,
                padding: 26,
                opacity: reveal,
                transform: `translateY(${mix(22, 0, reveal)}px)`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{fontFamily: MONO, fontSize: 34, fontWeight: 900, color: theme.accent, letterSpacing: '-0.02em'}}>{card[0]}</div>
              <div style={{marginTop: 18, fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em'}}>{card[1]}</div>
              <div style={{marginTop: 10, fontSize: 19, lineHeight: 1.6, color: theme.muted}}>{card[2]}</div>
              <div style={{position: 'absolute', right: 16, bottom: -18, fontFamily: MONO, fontSize: 118, fontWeight: 900, lineHeight: 1, color: alpha(theme.text, 0.055), letterSpacing: '-0.06em'}}>
                {card[0]}
              </div>
              <div style={{marginTop: 'auto', height: 3, width: `${18 + i * 6}%`, background: alpha(theme.accent, 0.5), borderRadius: 2}} />
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 1256,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${theme.line}`,
          paddingTop: 14,
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '0.16em',
          color: alpha(theme.text, 0.45),
        }}
      >
        <span>固定头像 · 内容优先</span>
        <span>CHAPTER {String(index + 1).padStart(2, '0')} / 04</span>
      </div>

      <div style={{position: 'absolute', left: 84, bottom: 210}}>
        <Placeholder kind="avatar" theme={theme} label="头像占位" radius={999} style={{width: 210, height: 210, border: `8px solid ${alpha(theme.surface, 0.9)}`, boxShadow: theme.shadow}} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 330,
          right: 84,
          bottom: 238,
          minHeight: 176,
          background: alpha(theme.surface, theme.dark ? 0.92 : 0.96),
          border: `1px solid ${theme.line}`,
          borderRadius: '24px 24px 24px 6px',
          padding: '30px 34px',
          boxShadow: theme.shadow,
          opacity: enter(local, 0, 18),
          transform: `translateY(${mix(16, 0, enter(local, 0, 18))}px)`,
        }}
      >
        <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', color: theme.accent, marginBottom: 10}}>SAY IT CLEAR</div>
        <div style={{fontSize: 30, lineHeight: 1.44, fontWeight: 800, letterSpacing: '-0.02em'}}>{data.bubble}</div>
      </div>

      <div style={{position: 'absolute', left: 84, right: 84, bottom: 74, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.5)}}>{String(index + 1).padStart(2, '0')} / 04</span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: alpha(theme.text, 0.5)}}>10 SEC</span>
      </div>
    </AbsoluteFill>
  )
}
