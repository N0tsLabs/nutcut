---
name: NutCut Video Workbench
description: Use when the user asks to make, review, or fix a video with NutCut, when the user hands over a NutCut repo, or when the user asks to install or attach the NutCut workbench as a skill. Confirms orientation/size/fps/duration before any work, then runs the local pipeline (MiniMax voice, HTML/Remotion templates, FFmpeg) and follows the project issue log.
---

# NutCut 视频工作台

你正在操作一个**本地、文件驱动**的 AI 视频工作台。仓库本身是规则来源，这份技能只负责把你带到正确的文件和命令。

## 0. 先找到仓库

仓库根目录 = 同时包含 `AGENTS.md`、`workflow.json`、`bin/doctor.mjs` 的目录。

- 用户给了路径：切到那个目录。
- 没给路径：用当前目录；不确定就问。
- 如果当前目录只是技能安装目录，不要在这里执行命令，先找到仓库。

按顺序读：

1. `AGENTS.md`
2. `workflow.json`
3. `docs/agent-quickstart.md`
4. `docs/agent-handoff.md`

然后跑：

```bash
npm install
node bin/doctor.mjs
```

doctor 的**必需项**不通过时先报告缺什么（FFmpeg / Chrome / 依赖 / 模板），不要开始做片；声音档案、MiniMax Key、BGM/SFX 属于可选能力，用原声或不做配音的项目可以缺。需要时让用户补 `.env` 或参考音频。

## 1. 硬门槛：视频规格

模板只决定风格、配色和动效，不决定横竖屏。写文案、生图、渲染之前，必须确认：

- 横屏 16:9 / 竖屏 9:16 / 方形 1:1
- 分辨率：1080p / 720p / 4K / 自定义宽高
- 帧率：24 / 25 / 30 / 50 / 60
- 目标时长（秒）和发布平台
- 声音：原声 / 克隆配音 / 无人声

缺哪项问哪项，**不要默认 9:16 或 16:9**。确认后写进 `project.json.spec` 和 `brief.json.spec`。

新建项目：

```bash
node bin/new-project.mjs --id <id> --title "<标题>" --template <模板 id> \
  --orientation <portrait|landscape|square> --quality <1080p|720p|4k> \
  --fps 30 --duration 30 --platform <平台> --audio <source|clone|none>
```

脚本拒绝创建时，把它列出的问题转给用户，不要绕过。

## 2. 接手现有项目

1. `node bin/status.mjs --project projects/<id>`
2. 读 `projects/<id>/issues.json`，保留用户原话
3. 读 `project.json`（spec / status / pipeline / assets）、`brief.json`、`script.json`
4. 动手前用一小段话说明准备改哪些文件、跑哪些命令
5. 用最小改动解决每条问题
6. 重新渲染：先关键帧，再全片
7. 用 `ffprobe` 和实际画面验收
8. 更新 `issues.json`：已解决项标注，未解决项保留

常用命令：

```bash
node bin/render.mjs --template projects/<id> --frames 60,360,630 --out out/check.png
node bin/produce.mjs --project projects/<id>
node bin/render-remotion.mjs --template templates/<id> --still 120 --out out/check.png
```

视频改片项目先读 `docs/video-workflow.md`，再按 `project.json.kind` 选择：

- `video-remix`：`bin/assemble.mjs`
- `video-frame`：`bin/frame-video.mjs`
- 模板项目：`bin/produce.mjs`

## 3. 新做一条视频

先判断路径，再按顺序走：

1. 规格确认 → **停下来等确认**
2. 素材导入与分析（有素材时）
3. **路径判断**：
   - 模糊方向 → `node bin/route.mjs --project projects/<id> --mode research`
   - 已有口播/产品/图片/视频/电视剧 → `--mode materials`
4. **只有 research 需要联网调研**：
   - 用你自己的 web search / browser 真实搜索
   - 至少记录 3 个来源、findings、angles 到 `projects/<id>/research.json`
   - `node bin/research.mjs --project projects/<id> --check`
   - 把调研结论给用户看 → `node bin/confirm.mjs --step research`
5. `brief.json`：主题、受众、角度、风险 → **停下来等确认** → `--step brief`
6. `style.json`：给 2–3 个模板/风格方案并推荐一个 → **停下来等确认** → `--step style`
7. `script.json`：逐句文案 → **停下来等确认** → `--step script`
8. 声音 → 时间线 → 关键帧 → **关键帧确认** → 全片 → 混音 → 导出

不要一条龙直接渲完成片。用户没有确认调研、brief、风格、文案或关键帧时，不要继续下一步。

### 需要用户回答时，停下来

不要自己在心里替用户选。需要决策时先记录：

```bash
node bin/ask.mjs --project projects/<id> \
  --question "这条视频主要发哪个平台？" \
  --options "抖音|视频号|B站|其他"
```

然后把问题原样发给用户并结束本轮，等用户回答后再继续。不要在 `pendingQuestion` 还没清掉时渲染。

### 用户确认后

```bash
node bin/confirm.mjs --project projects/<id> --step research
node bin/confirm.mjs --project projects/<id> --step brief --note "选题和受众通过"
node bin/confirm.mjs --project projects/<id> --step style --note "模板 A 通过"
node bin/confirm.mjs --project projects/<id> --step script
node bin/confirm.mjs --project projects/<id> --step keyframes
```

没有 `project.approvals` 里对应 `true`，`produce` / 全片 `render` / `frame-video` / `assemble` / 中控台导出都会拒绝。**不要自己替用户确认。**

模板在 `templates/`，先读 `template.json` 的 `palette` / `motion` / `stylePrompt`，再写生图 prompt。

## 4. 视觉与动效规则

- 不显示 NutCut Logo、软件名、水印，除非用户明确要求
- 竖屏 720×1280：字幕 ≥ 32px、标题 ≥ 44px、边距 ≥ 40px、字幕最多 2 行
- 横屏 1920×1080：字幕 ≥ 42px、标题 ≥ 72px、边距 ≥ 72px
- 标题、章节、标签必须来自素材内容
- 视频旁边始终要有章节 / 关键词 / 注释，不允许核心区域大面积空白
- 解释界面时，先运行 `node bin/capture-console.mjs --out projects/<id>/assets/imported/ui --preview data-console` 拿真实截图，再放进画面- 场景切换用 0.4–0.7 秒交叉淡化，不要硬切
- 位移 / 缩放用 `cubic-bezier(.16, 1, .3, 1)`
- 固定元素只在内容需要时移动，不要每句都动
- 禁止 `Date.now()`、`performance.now()`、`Math.random()` 参与画面
- 占位素材用纯色块 + “图片占位 / 视频占位 / 头像占位”，不要用渐变假装真实素材

## 5. 模板与 Remotion 预览

- 模板只定义风格；横竖屏、尺寸、帧率、时长以 `project.spec` 为准
- 模板原生画布与目标规格不同时，`project.layoutAdapted = false`，先改编 `src/index.html` 的版式，再跑 `node bin/adapt-layout.mjs --project projects/<id> --confirm`；未适配时 `produce` / `render` / 中控台导出会拒绝
- 中途改规格用 `node bin/set-spec.mjs --project projects/<id> --orientation ...`，改尺寸/画幅后需要重新适配
- 中控台：`node console/server.mjs` → `http://127.0.0.1:4173`
- 模板页预览 10 秒；带 `Remotion` 徽标的模板走 Player
- 这些 Remotion 模板默认 `previewOnly`：只做概念预览，项目成片仍走 HTML 版；不要用 `render-remotion.mjs` 代替项目导出
- 改模板后跑 `node bin/check-templates.mjs`
- 改 Remotion 后跑 `node bin/remotion-build.mjs --force`
- 模板设计说明：`templates/README.md`、`docs/remotion.md`

## 6. 声音 / 音乐 / 音效

- 只用 MiniMax 声音克隆 + `speech-2.8-turbo` TTS
- 克隆前确认授权；参考音频只裁首尾静音
- 复用 `voices/me/profile.json` 里已有的 `voiceId`，不要重复克隆
- BGM：`node bin/music.mjs --project projects/<id> --random`
- 音效：`node bin/sfx.mjs --project projects/<id> --set default`
- 混音目标 -16 LUFS，人声出现时 BGM 自动 ducking

## 7. 必须停下来问

- 没有 `spec`，或横竖屏 / 尺寸 / 帧率 / 时长不完整
- 无法判断走 research 还是 materials
- research 模式还没有真实来源和结论
- 风格/模板、brief、文案、关键帧没有用户确认
- 文案要引用素材里没有的具体信息
- 声音授权不明确
- 用户要的效果仓库里没有（在线协作、云渲染、内置剪辑器）
- 连续两次渲染失败，原因不明

## 8. 交付时报告

- 改了哪些文件
- 跑了哪些命令
- 输出文件路径（`out/<id>/film.mp4`、封面、关键帧）
- 规格是否与 `project.spec` 一致
- `issues.json` 还剩什么没解决

## 9. 如果用户让你“安装这个技能”

把本目录复制到 Agent 的技能目录，或运行仓库里的安装脚本：

```bash
node bin/install-skill.mjs --target opencode   # ~/.config/opencode/skills/nutcut
node bin/install-skill.mjs --target claude     # ~/.claude/skills/nutcut
node bin/install-skill.mjs --target project    # <repo>/.opencode/skills/nutcut
```

安装后：

1. 找到仓库根目录（包含 `AGENTS.md`）
2. 读 `AGENTS.md` 和 `workflow.json`
3. 跑 `node bin/doctor.mjs`
4. 告诉用户装到了哪里、doctor 是否通过

技能本身不包含密钥、素材或 `node_modules`，这些始终来自仓库和用户环境。
