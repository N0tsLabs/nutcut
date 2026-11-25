import fs from 'node:fs'
import path from 'node:path'

/** Minimal .env loader: KEY=VALUE lines, does not override existing env. */
export function loadEnv(file = '.env') {
  const target = path.resolve(file)
  if (!fs.existsSync(target)) return
  for (const line of fs.readFileSync(target, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}
