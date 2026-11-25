import React from 'react'
import {FONT, MONO, Theme, alpha, shade} from '../lib/theme'

type Kind = 'video' | 'photo' | 'avatar'

/**
 * 素材占位：纯色块 + 文字，不用渐变假装真实素材。
 * 正式项目里换成 <Video> / <Img> 即可，尺寸和圆角不变。
 */
export const Placeholder: React.FC<{
  kind: Kind
  theme: Theme
  label?: string
  color?: string
  style?: React.CSSProperties
  radius?: number
  labelSize?: number
  showIcon?: boolean
}> = ({kind, theme, label, color, style, radius = 20, labelSize = 15, showIcon = true}) => {
  const text = label || (kind === 'video' ? '视频占位' : kind === 'avatar' ? '头像占位' : '图片占位')
  const fill = color || shade(theme.surface, theme.dark ? 0.08 : -0.04)
  const labelColor = theme.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.42)'
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        background: fill,
        border: `1px solid ${alpha(theme.text, theme.dark ? 0.12 : 0.1)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {kind === 'avatar' ? (
        <div
          style={{
            width: '42%',
            height: '42%',
            minWidth: 48,
            minHeight: 48,
            borderRadius: '50%',
            background: alpha(theme.text, theme.dark ? 0.14 : 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: labelColor,
            fontFamily: MONO,
            fontSize: Math.max(10, labelSize - 2),
            letterSpacing: '0.1em',
          }}
        >
          {showIcon ? text : null}
        </div>
      ) : (
        <div style={{display: 'flex', alignItems: 'center', gap: 12, color: labelColor}}>
          {showIcon ? (
            kind === 'video' ? (
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: `1.5px solid ${alpha(theme.text, theme.dark ? 0.3 : 0.22)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  paddingLeft: 3,
                }}
              >
                ▶
              </span>
            ) : (
              <span
                style={{
                  width: 34,
                  height: 26,
                  borderRadius: 4,
                  border: `1.5px solid ${alpha(theme.text, theme.dark ? 0.3 : 0.22)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                }}
              >
                ▣
              </span>
            )
          ) : null}
          <span style={{fontFamily: FONT, fontSize: labelSize, fontWeight: 800, letterSpacing: '0.16em'}}>{text}</span>
        </div>
      )}
    </div>
  )
}

/** 细网格背景，纯 CSS，不请求网络 */
export const Grid: React.FC<{theme: Theme; size?: number; opacity?: number; style?: React.CSSProperties}> = ({
  theme,
  size = 90,
  opacity = 0.5,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      backgroundImage: `linear-gradient(90deg,${alpha(theme.text, 0.06)} 1px,transparent 1px),linear-gradient(0deg,${alpha(theme.text, 0.04)} 1px,transparent 1px)`,
      backgroundSize: `${size}px ${size}px`,
      ...style,
    }}
  />
)

/** 柔和光斑，位置固定，不参与随机 */
export const Glow: React.FC<{
  theme: Theme
  x: number
  y: number
  size: number
  color?: string
  opacity?: number
}> = ({theme, x, y, size, color, opacity = 0.4}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: '50%',
      background: `radial-gradient(circle,${alpha(color || theme.accent, opacity)} 0%,transparent 68%)`,
      pointerEvents: 'none',
    }}
  />
)

/** 进度条 */
export const Progress: React.FC<{
  frame: number
  duration: number
  theme: Theme
  width?: number
  height?: number
  style?: React.CSSProperties
}> = ({frame, duration, theme, width = 200, height = 3, style}) => (
  <div style={{width, height, background: alpha(theme.text, 0.14), borderRadius: height, overflow: 'hidden', ...style}}>
    <div
      style={{
        width: `${Math.min(100, (frame / Math.max(1, duration)) * 100)}%`,
        height: '100%',
        background: theme.accent,
        borderRadius: height,
      }}
    />
  </div>
)
