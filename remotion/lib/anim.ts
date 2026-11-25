/**
 * Remotion 动效工具。
 *
 * 规则与 templates/README.md 一致：
 * - 位移/缩放进场统一 cubic-bezier(.16, 1, .3, 1)
 * - 场景切换 0.6–0.7 秒交叉淡化
 * - 全部由 frame 计算，不使用 Date.now / Math.random
 */
import {Easing, interpolate} from 'remotion'

export const EASE = Easing.bezier(0.16, 1, 0.3, 1)
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)

/** 场景交叉淡化帧数（30fps 下 12 帧 ≈ 0.4 秒） */
export const SCENE_FADE = 12
/** 元素入场帧数 */
export const ENTER = 18

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/** 0→1 入场进度，带贝塞尔缓动 */
export function enter(frame: number, start = 0, duration = ENTER): number {
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing: EASE,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

/** 交叉淡化进度：场景切换时从 0 到 1 */
export function fadeIn(frame: number, start: number, duration = SCENE_FADE): number {
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing: EASE_IN_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

/**
 * 当前场景信息。
 * per: 每个场景帧数；fade: 场景切换交叉淡化帧数。
 */
export function sceneAt(frame: number, sceneCount: number, per: number) {
  const raw = frame / per
  const index = Math.max(0, Math.min(sceneCount - 1, Math.floor(raw)))
  return {
    index,
    local: frame - index * per,
    progress: clamp01((frame - index * per) / per),
    start: index * per,
  }
}

/**
 * 场景层透明度：每个场景是一层，边界处前后两层交叉淡化。
 * 第 0 层从 1 开始，最后一层到结尾保持 1。
 */
export function sceneOpacity(frame: number, index: number, sceneCount: number, per: number, fade = SCENE_FADE): number {
  const start = index * per
  const end = start + per
  const inOpacity = index === 0 ? 1 : fadeIn(frame, start, fade)
  const outOpacity = index === sceneCount - 1 ? 1 : 1 - fadeIn(frame, end, fade)
  return Math.min(inOpacity, outOpacity)
}

/**
 * 共享元素跨场景的连续过渡进度。
 * 返回 0 → 1：0 表示还停在上一个场景的位置，1 表示已经到当前场景的位置。
 * 元素在场景开头 0.7 秒内连续移动，不硬切。
 */
export function morphProgress(frame: number, index: number, per: number, duration = 20): number {
  if (index <= 0) return 1
  return enter(frame - index * per, 0, duration)
}

/** 数字滚动 */
export function countUp(frame: number, start: number, duration: number, to: number, from = 0): number {
  const progress = enter(frame, start, duration)
  const value = from + (to - from) * progress
  return Math.round(value * 10) / 10
}

/** 确定性噪声，用于波形/粒子，不使用 Math.random */
export function noise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** 打字机效果的可见字符数 */
export function typedLength(frame: number, start: number, length: number, perChar = 2): number {
  return Math.max(0, Math.min(length, Math.floor((frame - start) / perChar)))
}
