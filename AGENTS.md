# AGENTS.md · NutCut

> 本地 AI 视频工作台：**MiniMax 声音克隆 / TTS / 生图 + HTML/Canvas 动效 + 浏览器逐帧渲染 + FFmpeg 合成 + 本地中控台 + 项目详情页**。
>
> 任何 Agent clone 仓库后，先跑 `node bin/doctor.mjs`，再读 `workflow.json`、`docs/agent-quickstart.md` 和本文件。

---

## 1. 30 秒启动

```bash
npm install
node bin/doctor.mjs
node console/server.mjs
# http://127.0.0.1:4173
```

检查某个项目现在缺什么：

```bash
node bin/status.mjs --project projects/<id>
```

它会输出当前阶段、缺失文件、待处理问题和下一步建议。

要把项目交给别的 Agent：让它安装 `skills/nutcut/SKILL.md`（`node bin/install-skill.mjs --target opencode`），或直接读 `docs/agent-handoff.md`。

---

## 2. 固定流程

一条片子按 10 个阶段走，不跳步：

1. **规格确认**：先问清楚横屏 / 竖屏 / 方形、尺寸、帧率、时长、平台、声音来源。
2. **素材接收**：用户提供的图片、视频、音频、文档，先导入并分析。
3. **选题与风格**：写 `brief.json`，确认主题、受众、角度、模板/风格、风险，等用户确认。
4. **文案**：写 `script.json`，等用户确认。
5. **声音**：MiniMax 逐句合成，写入 `out/<id>/vo/`。
6. **时间线**：按真实语音时长写 `src/timings.js` 和 `timing.json`。
7. **画面**：按模板风格生成图片 / 渲关键帧，**等用户确认关键帧**再渲全片。
8. **混音**：BGM、音效、ducking、-16 LUFS。
9. **导出**：合成 MP4、封面、更新 `project.json`。
10. **审阅**：读用户问题记录，修改或确认。

### 视频规格是硬门槛

模板只定义**风格、配色和动效**，不决定横屏还是竖屏。每次做新视频，先确认并写入 `project.json` 和 `brief.json` 的 `spec`：

```json
"spec": {
  "orientation": "portrait",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 30,
  "platform": "douyin",
  "audio": "source",
  "confirmed": true
}
```

规则：

- 用户没明确说横竖屏/方形时，**必须问**，不要默认 9:16 或 16:9。
- 尺寸、帧率、时长、平台、声音来源缺哪项问哪项，可以合并成一次问。
- 不要因为模板原生画布是竖屏就推断用户要竖屏；也不要因为要做横屏就换模板。
- 没有 `spec` 或 `spec.confirmed !== true` 时，不进入 brief、文案和渲染。
- 模板原生画布与目标画幅不一致时，`project.layoutAdapted` 为 `false`，Agent 必须先改编 `src/index.html` 的版式，跑 `node bin/adapt-layout.mjs --project projects/<id> --confirm` 标记后，再渲关键帧。未适配的项目，`produce` / `render` / 中控台导出会直接拒绝。
- 中途改规格用 `node bin/set-spec.mjs --project projects/<id> --orientation ...`；尺寸或画幅变化后 `layoutAdapted` 会重置，必须重新适配。

完整输入输出和检查点见 `workflow.json`。

一键：

```bash
node bin/produce.mjs --project projects/<id>
```

只重跑某步：

```bash
node bin/voice.mjs --project projects/<id>
node bin/timeline.mjs --project projects/<id>
node bin/audio-mix.mjs --project projects/<id>
node bin/render.mjs --template projects/<id> --out out/<id>/film-silent.mp4
```

---

## 3. 项目结构

```
projects/<id>/
  brief.json            选题、受众、角度、可行性、图片计划
  script.json           文案、分句、声音指令、intro/gap/outro
  project.json          项目状态、spec、资产、模板、流程
  issues.json           问题记录，详情页自动保存，Agent 先读这个
  imports.json          用户导入素材清单 + 分析结果
  edit.json             混音的音量 / 静音 / 音乐起点
  edl.json              视频混剪的剪辑决策表
  style.json            风格决策：overlay / frame-motion / remix-edl
  frame.json            口播画中画的窗口、章节、字幕参数
  analysis/             镜头、关键帧、ASR、静音、配音决策
  motion.json           OpenMotion 清单
  params.schema.json    参数合同
  presets/default.json  默认参数
  src/index.html        可 seek 的 HTML 模板
  src/timings.js        自动生成，不要手改
  assets/imported/      用户导入的照片、视频、音频
  assets/generated/     MiniMax 生成的图片 + sidecar json
out/<id>/
  vo/                   逐句 wav + vo.json
  timing.json           时间线
  audio/                音乐、音效中间文件
  sfx/                  项目选中的音效
  bgm.mp3               项目选中的 BGM
  mix.wav               混音
  film-silent.mp4       无声渲染
  film.mp4              成片
  poster.png            封面
```

`project.json` 关键字段：

- `id`、`title`、`subtitle`、`summary`、`tags`
- `kind`：`video-remix` 表示按 EDL 混剪；省略表示模板/生成型项目
- `status`：`idea | script | voice | render | review | done | template`
- `stage`：当前阶段
- `duration`、`voiceProfile`、`template`
- `assets`：`video`、`poster`、`mix`、`silent`、`template`、`timings`、`vo`
- `voiceLines`：`{ id, text, duration, file }`
- `pipeline`：`{ id, label, status }`

---

## 4. 声音、BGM、音效

- **只用 MiniMax**：声音克隆 + `speech-2.8-turbo` TTS；不再使用其它 TTS / Edge TTS。
- 正式声音档案：`voices/me/profile.json`，源文件：`voices/me/me.m4a`，参考：`voices/me/reference.wav`。
- 参考音频只允许裁掉首尾静音；中间停顿、气息、节奏不得剪。当前裁切点 `0.90s–14.30s`。
- 已克隆的 `voice_id` 保存在 `profile.json` 的 `minimax.voiceId`，后续复用，不要重复克隆。
- 克隆用 `MINIMAX_API_KEY`（按量计费）；T2A / 生图用 `MINIMAX_PLAN_KEY`（Go 套餐），失败不回退余额。

```bash
node bin/voice.mjs --project projects/<id>
node bin/voice.mjs --project projects/<id> --test
```

BGM：

- `library/music/`：166 首 Open Lo-Fi（CC0）+ 12 首 DURU 远程（CC0）。
- 选曲：`node bin/music.mjs --project projects/<id> --remote --random --style cinematic`
- 写入 `out/<id>/bgm.mp3`。

SFX：

- `library/sfx/`：609 个 CC0 音效。
- 分类：转场 / 冲击 / 点击 / 弹出 / 提示 / 打字 / 故障 / 界面 / 拟音 / 环境。
- 选择：`node bin/sfx.mjs --project projects/<id> --set default`
- 写入 `out/<id>/sfx/`，中控台可直接试听。

混音：

- 自动 ducking：attack 120ms，release 800ms。
- `edit.json` 里的音量 / 静音 / 音乐起点会在导出时生效。
- 重建索引：`node bin/music-index.mjs`、`node bin/sfx-index.mjs`。

---

## 5. 中控台与项目详情

```bash
node console/server.mjs
# http://127.0.0.1:4173
```

项目页是独立详情页，不再弹框：

- 默认进入「详情」：成片播放器、右侧自动保存的问题记录、文案与节奏
- 详情页底部折叠「工程信息与文件」：项目编号、模板、声音、全部产物
- 页签：详情、流程、研究、文案、声音、素材
- 素材页可导入文件、试听逐句声音和成片、查看生成图片与工程产物
- 流程页只显示制作阶段和进度，可滚动，不再按阶段留言
- 修改由 Agent 执行：用户在详情页右侧「问题记录」里写，自动保存到 `issues.json`，Agent 读取后重新生成
 
---

## 6. 问题记录协议

所有修改意见统一写在项目详情页右侧的「问题记录」里，输入时自动保存：

```
projects/<id>/issues.json
{
  "text": "一条一条写的问题",
  "updatedAt": "2026-11-24T12:00:00.000Z"
}
```

规则：

- Agent 每轮先读 `issues.json`，逐条处理 `text` 里的问题。
- 处理完后更新 `issues.json`：保留未解决项，已解决项可以删掉或标注，不要丢掉用户原话。
- 需要用户补充时，明确告诉用户：「项目详情页 → 右侧问题记录」。

---

## 7. 素材管理

用户导入：

```bash
node bin/import.mjs --project projects/<id> --file "D:/素材/照片.jpg" --analysis "室内、暖光、人物"
```

- 文件进入 `projects/<id>/assets/imported/`。
- 记录进入 `imports.json`。
- **有用户素材时，必须先分析素材，再写 `brief.json` 和 `script.json`。**
- 不要覆盖或删除用户原始素材。
- 分析结果写入 `imports.json` 的 `analysis` 字段。

---

## 8. 模板

模板只定义**风格、配色、字体和动效**，不绑定横屏或竖屏。横竖屏和尺寸是项目级 `spec`，新建项目时确认。

内置模板在 `templates/`，每套包含：

- `template.json`：名称、分类、配色、字体、动效、stylePrompt
- `src/index.html`：可渲染模板（原生画布仅作设计参考）
- `motion.json` / `presets/default.json` / `params.schema.json`

新建项目（必须带规格）：

```bash
node bin/new-project.mjs --id my-video --title "我的视频" --template tech-neon \
  --orientation portrait --quality 1080p --fps 30 --duration 30 --audio source
```

不提供 `--orientation` / `--size` / `--duration` 时脚本会拒绝创建，并列出需要先问用户的问题。

中控台「模板」页支持 **10 秒实时预览**：4 段、3 次转场。模板共 33 套，按 `group` 分类：

- 口播/头像：`talk-frame`、`talk-corner`、`talk-split`、`talk-rail`、`talk-bubble`
- 图片素材：`photo-story`、`photo-grid`、`photo-quote`、`photo-split`
- 视频素材：`video-montage`、`video-pip`、`video-split`、`video-lowerthird`
- 信息数据、风格片头、主题创意：各自的独立版式

其中 9 套带 `template.json.remotion`，预览走 Remotion Player；其余继续用 HTML 预览。Remotion composition 的尺寸只是预览画布，不是项目规格。

信息型模板还带表格、数据图、图片预留位（`data-image-slot` / `inputs.images`）；风格型模板以排版和动效为主，不强制塞表格。

风格参考：

```bash
node bin/style.mjs --list
node bin/style.mjs --show K34
```

来源见 `docs/style-references.md`，只借鉴分类和方向，不复制原始提示词。

Agent 必须先读 `template.json`，把 `palette`、`motion`、`stylePrompt` 写进 `brief.json` 和后续生图 prompt。

---

## 9. OpenMotion / 生图规则

- 需要真实感 / 概念图时，用 `bin/image.mjs` 调 MiniMax-H3-Image；默认只走 `MINIMAX_PLAN_KEY`。
- 模板只暴露 `window.renderFrame(frame, inputs)`，必须确定性。
- 场景切换用 0.7 秒 smoothstep 交叉淡化，入场/退场透明度也走缓动。
- 新模板统一使用 cubic-bezier(.16, 1, .3, 1) 做位移/缩放缓动。
- 固定元素需要移动时，用 0.5–0.8 秒连续位移/缩放，不要直接闪过去。
- A-roll 和 B-roll 如果共享同一个元素（头像、产品、手部、同一主体），优先用位置/尺寸连续过渡把它接过去，不要硬切。
- 禁止 `Date.now()`、`performance.now()`、`Math.random()` 参与画面。
- 声明 `network: false` 的模板不得请求网络。
- 资源就绪后设 `window.__ready = true`。
- 中文排版用 900 字重做大标题，400/600 做正文；保留 5% 安全边距。
- 先渲关键帧，再渲全片。
- 不要强行拉伸；宁可改文案、拆句、换模板。

---

## 10. 视频混剪 / 口播改片

**先读 `docs/video-workflow.md`。分析完素材后，不要默认直接剪；先让用户选风格：**

- `overlay` 原片增强：视频全屏，只加字幕/包装/音效/配音
- `frame-motion` 模板画中画：视频是页面里的一个元素，位置/大小随章节变化
- `remix-edl` 混剪/解说：按镜头重剪，插 B-roll，适合电影解说

选择写入 `projects/<id>/style.json`。不确定时必须问用户。

硬规则：

- 不显示 NutCut Logo、软件名、水印，除非用户明确要求
- 横竖屏、尺寸、帧率、时长没确认时，先问用户，不要默认
- 竖屏 720×1280 字幕 ≥ 32px、标题 ≥ 44px、边距 ≥ 40px、最多 2 行
- 横屏 1920×1080 字幕 ≥ 42px、标题 ≥ 72px、边距 ≥ 72px
- 标题、章节、标签必须来自素材内容，不加无关卡片
- `frame-motion` 必须让视频窗口随章节移动/缩放，不能固定在一个角落
- 视频旁边必须始终有内容（章节、关键词、注释、步骤），不允许核心区域大面积空白

已有能力：

- 镜头切分、关键帧、静音检测、MiniMax ASR、EDL 生成、FFmpeg 合成
- 自动判断是否需要配音，写在 `analysis/analysis.json` 的 `voice.mode`：
  - `source`：素材里有人声，保留原声，不调用 TTS
  - `clone`：没人声，且 `voices/me/profile.json` 存在，使用 `me` 克隆声音
  - `none`：没人声，也没有可用声音档案
- 口播改片会自动做：按句切镜头、去长静音、字幕、关键词标签、轻微推拉、BGM、-16 LUFS

命令：

```bash
# 1. 分析：镜头、关键帧、转写、静音、配音决策
node bin/analyze-video.mjs --file "D:/素材/口播.mp4" --out projects/<id>/analysis

# 2. 生成 EDL：原声/克隆/静音、字幕、标签、音乐、B-roll
node bin/remix-plan.mjs --analysis projects/<id>/analysis/analysis.json --out projects/<id>/edl.json --title "标题" --broll projects/<id>/broll.json

# 3. 合成：切片段、字幕、BGM、响度归一
node bin/assemble.mjs --edl projects/<id>/edl.json --out out/<id>/film.mp4
```

说明：

- 原声模式不需要 `bin/voice.mjs`；克隆模式需要先有配音音轨，并写入 `edl.voice.track`。
- ASR 使用 MiniMax `asr-1.0`，需要 `MINIMAX_API_KEY`。
- `analysis/keyframes/` 是镜头关键帧，供 Agent 或视觉模型写镜头卡。
- `broll.json` 可以按句子关键词指定 B-roll 源时间，例如香味/吸收/质地镜头；`remix-plan` 会把视频轨和原声轨分开。
- 视频改片项目在 `project.json` 写 `kind: "video-remix"`，中控台「导出成片」会重新跑 `bin/assemble.mjs`，不会走 `produce.mjs`。

### 口播画中画（推荐）

不重排原视频，只在模板里放一个小窗，避免音画不同步：

```bash
node bin/frame-video.mjs --project projects/<id>
```

- `project.kind = "video-frame"`，中控台「导出成片」会重新渲染模板层并合成
- `frame.json` 控制：视频窗口位置、卖点卡片、字幕、高亮词
- 模板：`templates/talk-frame/`，竖屏 720×1280
- 原视频完整播放，原声不切；模板层负责背景、卡片、字幕和动效
- 宽画幅/黑边镜头在 `compose-frame.mjs` 里自动模糊填充

---

## 11. Remotion 预览 / 渲染

9 套旗舰模板已有 Remotion composition，中控台模板页用 `@remotion/player` 实时预览。

```bash
node bin/remotion-build.mjs                     # 重打 console/ui/remotion-player.js
node bin/render-remotion.mjs --template templates/talk-frame --out out/a.mp4
node bin/render-remotion.mjs --composition DataConsole --still 120 --out out/a.png
```

规则：

- 模板的 `template.json.remotion.composition` 决定用哪套版式；`width/height` 必须和 composition 设计尺寸一致，不能照抄 `motion.json`。
- `palette` 自动从 `template.json` 注入，不需要在 `remotion.props` 里重复写。
- 没有 `remotion` 字段的模板继续用 HTML 预览，不要为了统一而全部重写。
- 这 9 套模板默认 `previewOnly`：Remotion 只做概念预览，项目成片仍走 HTML；不要用 `render-remotion.mjs` 代替项目导出。
- HTML 仍是默认成片引擎；Remotion 渲染是显式命令，不静默切换导出。
- 新增 composition 后跑 `node bin/remotion-build.mjs --force`，再刷新模板页。
- composition 的宽高只是预览画布；项目实际横竖屏以 `project.spec` 为准。
- 渲染临时目录固定在 `.cache/tmp`，可用 `NUTCUT_TEMP_DIR` 覆盖；不要改回系统 `%TEMP%`，Windows 沙箱下会被拒绝写入。
- Remotion 授权：个人和 ≤3 人团队免费，更大团队需要 Company License。
- 完整说明见 `docs/remotion.md`。

---

## 12. 当前项目

本地项目放在 `projects/<id>/`，默认不提交到仓库。用下面的命令查看当前机器上的项目：

```bash
node bin/status.mjs --project projects/<id>
```

---

## 13. 删除 / 清理原则

- 旧 Edge TTS 脚本、旧旁白、旧测试音频已经删除；不要恢复。
- 生成物放 `out/`，中间帧自动清理；手写源码不要放 `out/`。
- 改参考音频后必须更新 `voices/me/profile.json` 的 `sha256`。
- 删除项目前确认 `project.json`、`issues.json`、用户素材没有未备份内容。
- 剪映 / 抖音内置音效属于版权素材，不要提交进仓库。
