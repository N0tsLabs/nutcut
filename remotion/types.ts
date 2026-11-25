import type {Palette} from './lib/theme'

export type Chapter = {
  title: string
  note?: string
  keyword?: string
}

/** 所有 composition 共用的输入。模板通过 template.json.remotion.props 覆盖。 */
export type ReelProps = {
  palette?: Partial<Palette>
  kicker?: string
  title?: string
  subtitle?: string
  label?: string
  chapters?: Chapter[]
  captions?: string[]
}
