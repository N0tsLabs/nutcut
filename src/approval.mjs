/**
 * 项目路径与确认状态。
 *
 * 两条路径：
 * - research：模糊方向，先联网调研，再 brief / style / script / keyframes
 * - materials：已有口播、产品、图片、视频、电视剧等明确素材，跳过调研
 *
 * 顺序：route → (research) → brief → style → script → keyframes → 才允许全片渲染。
 * 任何一步没有用户确认，produce / render / frame-video / assemble / 中控台导出都会被拦住。
 */
export const APPROVAL_STEPS = ['research', 'brief', 'style', 'script', 'keyframes']

export function currentApprovals(project) {
  const raw = project?.approvals
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

export function requiredApprovalSteps(project, { keyframes = true } = {}) {
  const steps = []
  if (project?.mode === 'research') steps.push('research')
  steps.push('brief', 'style', 'script')
  if (keyframes) steps.push('keyframes')
  return steps
}

export function missingApprovals(project, { keyframes = true } = {}) {
  const approvals = currentApprovals(project)
  return requiredApprovalSteps(project, { keyframes }).filter((step) => approvals[step] !== true)
}

export function approvalBlock(project, { keyframes = true } = {}) {
  if (project?.pendingQuestion?.status === 'open') {
    const options = project.pendingQuestion.options?.length ? ` 选项：${project.pendingQuestion.options.join(' / ')}` : ''
    return `正在等用户回答：${project.pendingQuestion.question}${options}。先处理这个回答，再继续。`
  }
  if (!project?.mode) {
    return '还没判断视频路径：先确认是「模糊方向，需要调研」还是「已有明确素材，直接做」，再运行 node bin/route.mjs --project projects/<id> --mode research|materials'
  }
  const missing = missingApprovals(project, { keyframes })
  if (!missing.length) return null
  const labels = {
    research: '联网调研',
    brief: '选题/受众/角度',
    style: '风格/模板',
    script: '文案',
    keyframes: '关键帧',
  }
  const id = project?.id || '<id>'
  return `项目还没确认：${missing.map((step) => labels[step] || step).join('、')}。先给用户看对应内容，再运行 node bin/confirm.mjs --project projects/${id} --step ${missing[0]}`
}

export function confirmationLabel(step) {
  return {
    research: '联网调研',
    brief: '选题/受众/角度',
    style: '风格/模板',
    script: '文案',
    keyframes: '关键帧',
  }[step] || step
}
