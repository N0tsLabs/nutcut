# Agent 快速开始

> 这个仓库是给 Agent 用的视频工作台。clone 之后，先跑 `node bin/doctor.mjs`，再读 `workflow.json` 和 `AGENTS.md`。

---

## 0. 首次准备

```bash
npm install
cp .env.example .env
node bin/doctor.mjs
```

需要：

- Node 20+
- FFmpeg / FFprobe
- Chrome 或 Edge
- `.env` 里的 `MINIMAX_API_KEY`（克隆用）和 `MINIMAX_PLAN_KEY`（TTS / 生图 / ASR）
- `voices/me/me.m4a` 和 `voices/me/profile.json`

---

## 1. 每次开始先看状态

```bash
node bin/status.mjs --project projects/<id>
node bin/status.mjs --project projects/<id> --json
```

它会告诉你：

- 当前阶段
- 缺哪些文件
- 有没有未处理的问题记录
- 用户导入了多少素材、分析了多少
- 下一步建议

---

## 2. 新建项目

```bash
node bin/new-project.mjs --id my-video --title "我的视频" --template tech-neon \
  --orientation portrait --quality 1080p --fps 30 --duration 30 --audio source
```

模板只决定风格和配色。没有提供横竖屏、尺寸、帧率、时长时，先问用户，不要默认。

建完项目先判断路径：

```bash
node bin/route.mjs --project projects/<id> --mode research --reason "用户只给了模糊方向"
node bin/route.mjs --project projects/<id> --mode materials --reason "用户给了口播/产品/素材"
```

- `research`：必须真实联网搜索，至少 3 个来源写入 `research.json`，再 brief/style/文案。
- `materials`：跳过调研，直接 brief/style/文案。
- 不确定就用 `bin/ask.mjs` 问用户。

模板在 `templates/`，每套都有：

- `template.json`：风格、配色、标签、给 Agent 的 stylePrompt
- `src/index.html`：可渲染的 OpenMotion 模板
- `motion.json` / `presets/default.json`
- 带 `template.json.remotion` 的模板，中控台预览走 Remotion Player；渲染用 `bin/render-remotion.mjs`

Agent 必须先读 `template.json`，把风格写进 `brief.json` 和画面 prompt。

---

## 3. 接用户素材

```bash
node bin/import.mjs --project projects/<id> --file "D:/素材/照片.jpg"
node bin/import.mjs --project projects/<id> --file a.png --file b.mp4 --analysis "室内、暖光、人物"
node bin/capture-console.mjs --out projects/<id>/assets/imported/ui --preview data-console
```

`capture-console` 会抓中控台、模板页和 Remotion 预览的真实截图，适合做产品介绍或教程视频；需要中控台正在运行。

文件会进入：

```
projects/<id>/assets/imported/
```

记录在：

```
projects/<id>/imports.json
```

**有素材时，先分析素材，再写 brief 和文案。** 不要不看素材就直接生成。

---

## 4. 选题与可行性

写 `projects/<id>/brief.json`：

```json
{
  "topic": "主题",
  "audience": "受众",
  "angle": "切入角度",
  "format": "30 秒说明短片",
  "template": "tech-neon",
  "references": [{ "title": "资料", "url": "", "note": "" }],
  "feasibility": {
    "score": 8,
    "risks": ["风险 1", "风险 2"],
    "decision": "go",
    "notes": ""
  },
  "imagePlan": [{ "scene": "s1", "prompt": "画面描述", "status": "待生成" }]
}
```

写完先给用户确认，不要直接开做。

---

## 5. 文案 → 声音 → 时间线 → 画面 → 混音 → 导出

```bash
node bin/voice.mjs --project projects/<id>
node bin/timeline.mjs --project projects/<id>
node bin/image-plan.mjs --project projects/<id>
node bin/render.mjs --template projects/<id> --frames 60,360,630 --out out/check.png
node bin/music.mjs --project projects/<id> --random --category ambient-lofi
node bin/sfx.mjs --project projects/<id> --set default
node bin/audio-mix.mjs --project projects/<id>
node bin/produce.mjs --project projects/<id>
```

每一步的输入、输出、检查点见 `workflow.json`。

---

## 6. 看问题记录

所有修改意见统一写在项目详情页右侧的「问题记录」，输入时自动保存：

```
projects/<id>/issues.json
{
  "text": "一条一条写的问题",
  "updatedAt": "2026-11-24T12:00:00.000Z"
}
```

规则：

- 每轮先读 `issues.json`，逐条处理 `text` 里的问题
- 处理完更新 `issues.json`：保留未解决项，不要丢掉用户原话
- 需要用户补充时，引导用户去「项目详情页 → 右侧问题记录」
- `issues.json` 是唯一的问题记录来源

---

## 7. 视频混剪 / 口播改片

分析完素材后，先让用户选风格，再开始做：

- `overlay` 原片增强：视频全屏，只加字幕/包装/音效/配音
- `frame-motion` 模板画中画：视频是页面元素，位置/大小随章节变化
- `remix-edl` 混剪/解说：按镜头重剪，插 B-roll

选择写入 `projects/<id>/style.json`。硬规则见 `docs/video-workflow.md`。

```bash
node bin/analyze-video.mjs --file "D:/素材/口播.mp4" --out projects/<id>/analysis
node bin/frame-video.mjs --project projects/<id>
```

- `analysis.json` 里会判断 `voice.mode = source | clone | none`
- `source` 表示保留原声，不调用 TTS
- `clone` 表示素材没人声，且已有 `voices/me/profile.json`
- 口播改片默认按句重切、去长静音、字幕、关键词标签、轻微推拉、BGM、-16 LUFS
- 视频改片项目写 `kind: "video-remix"`，中控台导出会跑 `assemble.mjs`

### 口播画中画（推荐）

不重排原视频，避免音画不同步：

```bash
node bin/frame-video.mjs --project projects/<id>
```

- 模板 `templates/talk-frame/`：视频小窗 + 右侧卖点卡片 + 底部字幕
- 参数 `projects/<id>/frame.json`
- 项目写 `kind: "video-frame"`，中控台导出会重新渲染模板层并合成

---

## 8. 中控台

```bash
node console/server.mjs
# http://127.0.0.1:4173
```

项目页 = 独立详情页：

- 默认「详情」：成片播放器、右侧自动保存的问题记录、文案与节奏
- 工程信息与文件默认折叠在页面底部
- 页签：详情、流程、研究、文案、声音、素材
- 流程页：只显示制作阶段和进度，可滚动
- 素材页：导入文件、试听逐句声音和成片、查看生成图片与工程产物
- 修改统一由 Agent 执行：用户在问题记录里写，自动保存到 `issues.json`

---

## 9. 不要做的事

- 不要跳过 `brief.json` 直接写文案
- 不要重复克隆 MiniMax 声音
- 不要手改 `src/timings.js`
- 不要把非 CC0 的剪映 / 抖音音效提交进仓库
- 不要覆盖用户导入的原始素材
- 不要在用户没确认文案前生成整片
