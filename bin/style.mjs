#!/usr/bin/env node
/**
 * 浏览代码动画风格参考，选择模板方向。
 *
 *   node bin/style.mjs --list
 *   node bin/style.mjs --list --category 科技
 *   node bin/style.mjs --show K34
 *   node bin/style.mjs --list --json
 */
import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function has(name) { return process.argv.includes(`--${name}`) }
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

const file = path.join('templates', 'style-catalog.json')
const catalog = readJson(file)
let styles = catalog.styles || []

const category = arg('category')
if (category) styles = styles.filter((style) => String(style.category).includes(category))
const id = arg('id') || arg('show')

if (id) {
  const style = catalog.styles.find((item) => item.id.toLowerCase() === id.toLowerCase())
  if (!style) throw new Error(`找不到风格：${id}`)
  console.log(JSON.stringify(style, null, 2))
  process.exit(0)
}

if (has('json')) {
  console.log(JSON.stringify({ source: catalog.source, count: styles.length, styles }, null, 2))
  process.exit(0)
}

console.log(`NutCut 风格参考 · ${styles.length}/${catalog.styles.length}`)
console.log(`来源：${catalog.source.url}（只参考分类和方向）\n`)
for (const style of styles) {
  console.log(`${style.id.padEnd(4)} ${style.name.padEnd(10)} ${String(style.category).padEnd(8)} → ${style.closestTemplate || '待新建模板'}`)
}
console.log('\n用法：node bin/style.mjs --show K34')
