/**
 * 项目确认状态。
 *
 * 顺序：spec → brief（含风格/选题）→ script → keyframes → 才允许全片渲染。
 * 没有对应确认时，produce / render / frame-video / assemble / 中控台导出都会被拦住。
 */
export const APPROVAL_STEPS = ['brief', 'script', 'keyframes']

export function currentApprovals(project) {
  const raw = project?.approvals
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

export function missingApprovals(project, { keyframes = true } = {}) {
  const approvals = currentApprovals(project)
  const missing = []
  if (approvals.brief !== true) missing.push('brief')
  if (approvals.script !== true) missing.push('script')
  if (keyframes && approvals.keyframes !== true) missing.push('keyframes')
  return missing
}

export function approvalBlock(project, { keyframes = true } = {}) {
  const missing = missingApprovals(project, { keyframes })
  if (!missing.length) return null
  const labels = { brief: '选题/风格', script: '文案', keyframes: '关键帧' }
  const id = project?.id || '<id>'
  return `项目还没确认：${missing.map((step) => labels[step] || step).join('、')}。先给用户看对应内容，再运行 node bin/confirm.mjs --project projects/${id} --step ${missing[0]}`
}

export function confirmationLabel(step) {
  return { brief: '选题/风格', script: '文案', keyframes: '关键帧' }[step] || step
}
