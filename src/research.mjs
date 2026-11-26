import fs from 'node:fs'

/**
 * research.json 的最低要求。
 * 模糊方向必须至少看过 3 个来源，并写出自己的结论和可拍角度。
 */
export function validateResearch(file) {
  if (!fs.existsSync(file)) {
    return { ok: false, errors: ['还没有 research.json；先联网搜索并记录来源'] }
  }
  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    return { ok: false, errors: [`research.json 不是合法 JSON：${error.message}`] }
  }
  const sources = Array.isArray(data.sources) ? data.sources : []
  const queries = Array.isArray(data.queries) ? data.queries : []
  const findings = Array.isArray(data.findings) ? data.findings : []
  const angles = Array.isArray(data.angles) ? data.angles : []
  const errors = []
  if (!queries.length) errors.push('至少记录 1 个实际搜索词（queries）')
  if (sources.length < 3) errors.push('至少记录 3 个真实来源（title + url）')
  const badSource = sources.find((source) => !source || !source.url || !source.title)
  if (badSource) errors.push('每个来源都要有 title 和 url')
  if (!findings.length) errors.push('至少写 1 条 findings（你从资料里得出的结论）')
  if (!angles.length) errors.push('至少写 1 个 angles（可执行的内容角度）')
  return { ok: errors.length === 0, errors, data, sources: sources.length, findings: findings.length, angles: angles.length }
}

export function researchSummary(file) {
  const result = validateResearch(file)
  if (!result.ok) return result
  return {
    ok: true,
    sources: result.sources,
    findings: result.findings,
    angles: result.angles,
    data: result.data,
  }
}
