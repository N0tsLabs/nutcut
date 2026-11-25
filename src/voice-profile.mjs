import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

/** Read a voice profile directory (or profile.json) and verify its reference audio. */
export function readProfile(value) {
  const target = path.resolve(value)
  if (!fs.existsSync(target)) throw new Error(`声音档案不存在：${target}`)
  const file = fs.statSync(target).isDirectory() ? path.join(target, 'profile.json') : target
  if (!fs.existsSync(file)) throw new Error(`缺少 profile.json：${file}`)
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'))
  const reference = path.resolve(path.dirname(file), profile.reference)
  if (!fs.existsSync(reference)) throw new Error(`档案里的参考音频不存在：${reference}`)
  if (profile.sha256 && profile.sha256 !== sha256File(reference)) {
    throw new Error(`参考音频与档案指纹不一致，请重新生成档案：${reference}`)
  }
  return { ...profile, reference, profilePath: file }
}

export function probeDuration(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  return Number((result.stdout || '0').trim())
}
