import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {FONT, MONO, alpha, resolveTheme, shade} from '../lib/theme'
import {countUp, enter, mix, sceneAt, sceneOpacity} from '../lib/anim'
import {Grid, Progress} from '../components/Placeholder'
import type {ReelProps} from '../types'

const SCENES = [
  {title: '本周数据', kicker: 'DATA CONSOLE / 01', note: '先看整体，再看异常。'},
  {title: '转化路径', kicker: 'DATA CONSOLE / 02', note: '每一步的流失都要能解释。'},
  {title: '留存变化', kicker: 'DATA CONSOLE / 03', note: '留存是一个过程，不是一个点。'},
  {title: '复盘结论', kicker: 'DATA CONSOLE / 04', note: '把结论写成下一步动作。'},
]

const METRICS = [
  {label: '播放完成率', value: 68.4, suffix: '%', delta: '+12.6'},
  {label: '平均观看时长', value: 24.8, suffix: 's', delta: '+3.2'},
  {label: '互动率', value: 9.7, suffix: '%', delta: '+1.8'},
]

const BARS = [
  {label: 'MON', value: 0.42},
  {label: 'TUE', value: 0.58},
  {label: 'WED', value: 0.5},
  {label: 'THU', value: 0.76},
  {label: 'FRI', value: 0.92},
  {label: 'SAT', value: 0.66},
  {label: 'SUN', value: 0.54},
]

const ROWS = [
  ['01', '开场 3 秒', '2.4 万', '68.4%'],
  ['02', '第一次转折', '1.8 万', '54.2%'],
  ['03', '产品出现', '1.3 万', '41.8%'],
  ['04', '演示段落', '0.9 万', '33.5%'],
  ['05', '结尾行动', '0.7 万', '26.1%'],
]

export const dataConsoleDefaults: ReelProps = {
  kicker: 'DATA CONSOLE',
  title: '数据中控',
}

export const DataConsole: React.FC<ReelProps> = ({palette, kicker}) => {
  const frame = useCurrentFrame()
  const {durationInFrames, fps} = useVideoConfig()
  const theme = resolveTheme(palette)
  const per = durationInFrames / SCENES.length
  const scene = sceneAt(frame, SCENES.length, per)
  const index = scene.index

  const cardBg = alpha(theme.surface, theme.dark ? 0.72 : 0.82)
  const border = theme.line
  const activeBar = 3 + index
  const highlightY = index * 62

  const formatTime = (value: number) => {
    const total = Math.floor(value)
    const ss = String(total % 60).padStart(2, '0')
    const mm = String(Math.floor(total / 60)).padStart(2, '0')
    return `00:${mm}:${ss}`
  }

  return (
    <AbsoluteFill style={{background: theme.background, fontFamily: FONT, color: theme.text, overflow: 'hidden'}}>
      <Grid theme={theme} size={64} opacity={0.4} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(90% 70% at 100% 0%, ${alpha(theme.accent, theme.dark ? 0.14 : 0.1)}, transparent 60%)`,
        }}
      />

      <div style={{position: 'absolute', left: 72, right: 72, top: 58, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
        <div>
          <div style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.22em', color: theme.accent, fontWeight: 800}}>{kicker || SCENES[index].kicker}</div>
          <div style={{marginTop: 10, fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em'}}>{SCENES[index].title}</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end'}}>
            <span style={{width: 8, height: 8, borderRadius: '50%', background: theme.accent}} />
            <span style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: alpha(theme.text, 0.55)}}>LIVE · AUTO</span>
          </div>
          <div style={{marginTop: 8, fontFamily: MONO, fontSize: 22, fontWeight: 800, letterSpacing: '0.04em'}}>{formatTime(frame / fps)}</div>
        </div>
      </div>

      {/* 三个指标卡 */}
      <div style={{position: 'absolute', left: 72, top: 186, width: 918, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14}}>
        {METRICS.map((metric, i) => {
          const reveal = enter(frame, 8 + i * 5, 26)
          return (
            <div
              key={metric.label}
              style={{
                height: 168,
                borderRadius: 14,
                background: cardBg,
                border: `1px solid ${border}`,
                padding: '22px 22px 18px',
                opacity: reveal,
                transform: `translateY(${mix(18, 0, reveal)}px)`,
              }}
            >
              <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: alpha(theme.text, 0.5)}}>{metric.label}</div>
              <div style={{marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 4}}>
                <span style={{fontFamily: MONO, fontSize: 46, fontWeight: 900, letterSpacing: '-0.04em'}}>
                  {countUp(frame, 10 + i * 5, 54, metric.value).toFixed(1)}
                </span>
                <span style={{fontFamily: MONO, fontSize: 20, fontWeight: 800, color: alpha(theme.text, 0.6)}}>{metric.suffix}</span>
              </div>
              <div style={{marginTop: 12, fontFamily: MONO, fontSize: 12, color: theme.accent}}>{metric.delta} 较上周</div>
            </div>
          )
        })}
      </div>

      {/* 柱状图 */}
      <div style={{position: 'absolute', left: 72, top: 380, width: 918, height: 470, borderRadius: 16, background: cardBg, border: `1px solid ${border}`, padding: '24px 26px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <div style={{fontSize: 20, fontWeight: 800}}>每日播放量</div>
          <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: alpha(theme.text, 0.45)}}>7 DAYS</div>
        </div>
        <div style={{position: 'absolute', left: 26, right: 26, top: 96, bottom: 42, display: 'flex', alignItems: 'flex-end', gap: 18}}>
          {BARS.map((bar, i) => {
            const grow = enter(frame, 12 + i * 4, 34)
            const on = i === activeBar
            return (
              <div key={bar.label} style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%'}}>
                <div style={{height: `${Math.max(4, bar.value * grow * 100)}%`, background: on ? theme.accent : shade(theme.surface, theme.dark ? 0.22 : -0.14), borderRadius: '6px 6px 2px 2px', position: 'relative'}}>
                  {on ? (
                    <div style={{position: 'absolute', left: '50%', top: -30, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 12, fontWeight: 800, color: theme.accent, whiteSpace: 'nowrap'}}>
                      {Math.round(bar.value * 120)}K
                    </div>
                  ) : null}
                </div>
                <div style={{marginTop: 10, textAlign: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: on ? theme.text : alpha(theme.text, 0.4)}}>{bar.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 右侧表格 */}
      <div style={{position: 'absolute', left: 1016, top: 186, width: 832, height: 470, borderRadius: 16, background: cardBg, border: `1px solid ${border}`, padding: '24px 26px', overflow: 'hidden'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <div style={{fontSize: 20, fontWeight: 800}}>流失节点</div>
          <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: alpha(theme.text, 0.45)}}>TOP 5</div>
        </div>
        <div style={{marginTop: 20, display: 'grid', gridTemplateColumns: '44px 1fr 120px 90px', gap: 0, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: alpha(theme.text, 0.4)}}>
          <span>#</span>
          <span>节点</span>
          <span>人数</span>
          <span style={{textAlign: 'right'}}>占比</span>
        </div>
        <div style={{position: 'relative', marginTop: 10, height: 310}}>
          <div
            style={{
              position: 'absolute',
              left: -10,
              right: -10,
              top: highlightY,
              height: 56,
              borderRadius: 8,
              background: alpha(theme.accent, theme.dark ? 0.14 : 0.1),
              border: `1px solid ${alpha(theme.accent, 0.4)}`,
            }}
          />
          {ROWS.map((row, i) => (
            <div
              key={row[0]}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: i * 62,
                height: 56,
                display: 'grid',
                gridTemplateColumns: '44px 1fr 120px 90px',
                alignItems: 'center',
                fontFamily: MONO,
                fontSize: 14,
                color: i === index ? theme.text : alpha(theme.text, 0.55),
              }}
            >
              <span style={{color: i === index ? theme.accent : 'inherit'}}>{row[0]}</span>
              <span style={{fontFamily: FONT, fontWeight: i === index ? 800 : 600, fontSize: 16}}>{row[1]}</span>
              <span>{row[2]}</span>
              <span style={{textAlign: 'right'}}>{row[3]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 注释卡 */}
      <div style={{position: 'absolute', left: 1016, top: 676, width: 832, height: 174, borderRadius: 16, background: alpha(theme.accent, theme.dark ? 0.16 : 0.1), border: `1px solid ${alpha(theme.accent, 0.38)}`, padding: '24px 28px'}}>
        <div style={{fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: theme.accent, fontWeight: 800}}>NOTE</div>
        <div style={{marginTop: 12, fontSize: 26, lineHeight: 1.4, fontWeight: 800, letterSpacing: '-0.02em'}}>{SCENES[index].note}</div>
        <div style={{marginTop: 10, fontSize: 14, color: alpha(theme.text, 0.55)}}>数据为演示占位，接入真实数据后替换。</div>
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, bottom: 128, display: 'flex', gap: 34, fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: alpha(theme.text, 0.38)}}>
        <span>数据来源 · 演示占位</span>
        <span>采样 7 天</span>
        <span>刷新 5 秒</span>
        <span style={{marginLeft: 'auto'}}>FRAME / 30FPS</span>
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, bottom: 62, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: alpha(theme.text, 0.45)}}>
          {String(index + 1).padStart(2, '0')} / 0{SCENES.length}
        </span>
        <Progress frame={frame} duration={durationInFrames} theme={theme} style={{flex: 1}} />
        <span style={{fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: alpha(theme.text, 0.45)}}>10 SEC</span>
      </div>
    </AbsoluteFill>
  )
}
