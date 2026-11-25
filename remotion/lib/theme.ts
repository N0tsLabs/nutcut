/**
 * Remotion 设计系统 · 主题
 *
 * 所有 composition 都从模板的 palette 取色，保证 Remotion 预览和模板库里的
 * template.json 是同一套配色，不额外引入第二套色板。
 */

export type Palette = {
  background: string
  surface: string
  primary: string
  accent: string
  text: string
  muted: string
}

export type Theme = Palette & {
  dark: boolean
  line: string
  accentSoft: string
  shadow: string
}

export const FALLBACK_PALETTE: Palette = {
  background: '#101014',
  surface: '#181820',
  primary: '#f5f2ec',
  accent: '#ff8a5c',
  text: '#f5f2ec',
  muted: '#9c9ca8',
}

export const FONT = '"Noto Sans SC","Microsoft YaHei","PingFang SC","Segoe UI",sans-serif'
export const MONO = '"JetBrains Mono","Consolas","SFMono-Regular",monospace'

function parseHex(hex: string): [number, number, number] {
  const clean = String(hex || '').trim().replace('#', '')
  if (clean.length === 3) {
    return [parseInt(clean[0] + clean[0], 16), parseInt(clean[1] + clean[1], 16), parseInt(clean[2] + clean[2], 16)]
  }
  if (clean.length >= 6) {
    return [parseInt(clean.slice(0, 2), 16) || 0, parseInt(clean.slice(2, 4), 16) || 0, parseInt(clean.slice(4, 6), 16) || 0]
  }
  return [0, 0, 0]
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function alpha(hex: string, value: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${value})`
}

export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  const target = amount >= 0 ? 255 : 0
  const t = Math.abs(amount)
  const mix = (channel: number) => Math.round(channel + (target - channel) * t)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

export function resolveTheme(palette?: Partial<Palette> | null): Theme {
  const merged: Palette = { ...FALLBACK_PALETTE, ...(palette || {}) }
  for (const key of Object.keys(merged) as (keyof Palette)[]) {
    if (!merged[key] || typeof merged[key] !== 'string') merged[key] = FALLBACK_PALETTE[key]
  }
  const dark = luminance(merged.background) < 0.46
  const text = merged.text || (dark ? '#ffffff' : '#1a1a1a')
  return {
    ...merged,
    text,
    primary: merged.primary || text,
    muted: merged.muted || (dark ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.52)'),
    dark,
    line: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
    accentSoft: alpha(merged.accent, dark ? 0.18 : 0.12),
    shadow: dark ? '0 40px 120px rgba(0,0,0,0.55)' : '0 40px 120px rgba(40,24,18,0.18)',
  }
}
