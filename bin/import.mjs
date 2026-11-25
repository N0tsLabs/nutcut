#!/usr/bin/env node
/**
 * 把用户素材导入项目目录。
 *
 *   node bin/import.mjs --project projects/<id> --file "D:/素材/照片.jpg"
 *   node bin/import.mjs --project projects/<id> --file a.png --file b.mp4 --analysis "室内、暖光、人物"
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
function args(name) {
  const out = []
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1])
  }
  return out
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return fallback }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}
function rel(file) { return path.relative(process.cwd(), file).replace(/\\/g, '/') }

function main() {
  const projectArg = arg('project')
  if (!projectArg) throw new Error('用法：node bin/import.mjs --project projects/<id> --file <path> [--file <path>] [--analysis <说明>]')
  const projectDir = path.resolve(projectArg)
  const projectFile = path.join(projectDir, 'project.json')
  const project = readJson(projectFile)
  if (!project) throw new Error(`缺少 project.json：${projectDir}`)
  const files = args('file')
  if (!files.length) throw new Error('至少提供一个 --file')
  const analysis = arg('analysis', '')
  const importsFile = path.join(projectDir, 'imports.json')
  const imports = readJson(importsFile, [])
  const destDir = path.join(projectDir, 'assets', 'imported')
  fs.mkdirSync(destDir, { recursive: true })
  const added = []

  for (const sourceArg of files) {
    const source = path.resolve(sourceArg)
    if (!fs.existsSync(source)) throw new Error(`文件不存在：${source}`)
    let name = path.basename(source).replace(/[<>:"|?*\u0000-\u001f]/g, '_')
    let index = 1
    while (fs.existsSync(path.join(destDir, name))) {
      const ext = path.extname(name)
      name = `${path.basename(name, ext)}-${index}${ext}`
      index += 1
    }
    const dest = path.join(destDir, name)
    fs.copyFileSync(source, dest)
    const stat = fs.statSync(dest)
    const item = {
      id: crypto.randomUUID(),
      name,
      file: rel(dest),
      bytes: stat.size,
      mime: '',
      importedAt: new Date().toISOString(),
      analysis: analysis || null,
    }
    imports.push(item)
    added.push(item)
  }

  writeJson(importsFile, imports)
  project.imports = imports.map((item) => item.file)
  project.updatedAt = new Date().toISOString()
  writeJson(projectFile, project)
  console.log(JSON.stringify({ ok: true, added, total: imports.length }, null, 2))
}

main()
