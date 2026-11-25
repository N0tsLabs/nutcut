# NutCut

> **给任意 Agent 装上 NutCut，它就能从规格、选题、文案一直做到成片；每一步先和你确认，改到你满意再渲染。**
>
> 本地优先的 AI 视频工作台：MiniMax 声音克隆 / TTS / 生图 + HTML 模板 + Remotion 预览 + FFmpeg 合成 + 本地中控台。

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-early-orange)
![Agent](https://img.shields.io/badge/agent-native-7c3aed)

![NutCut 模板库](docs/assets/templates.png)

NutCut 不是让 Agent 直接“生成一段视频”。它把视频制作拆成一条可以停下来确认的流程：先确认画幅和规格，再确认风格和选题，再确认文案，最后才渲染。模板负责风格，Agent 负责内容，所有产物都是本地文件。

不依赖云渲染，不需要数据库，也不上传你的素材。

## 它是怎么工作的

安装一次技能，之后只需要说：

```text
用 NutCut 做一条 60 秒的产品介绍视频。
```

Agent 会按仓库里的流程执行：

1. **确认规格**：横屏 / 竖屏 / 方形、分辨率、帧率、时长、平台、声音来源。
2. **确认风格和选题**：从 33 套模板里选方向，写清主题、受众、角度和风险。
3. **确认文案**：逐句给你过，不满意就改；确认后才生成声音。
4. **确认画面**：先渲关键帧或片段，确认没有溢出、遮挡、空屏。
5. **渲染成片**：声音、时间线、混音、字幕、FFmpeg 合成。
6. **交付与修改**：你在项目详情页右侧「问题记录」里写意见，Agent 读 `issues.json` 继续改。

任何一步缺失信息，Agent 会先问你，而不是自己默认 16:9、默认 30 秒、默认用某个模板。

![Remotion 实时预览](docs/assets/remotion-preview.png)

## 特性

- **规格先行**：模板只决定风格；横竖屏、尺寸、帧率、时长在项目级 `spec` 确认，缺一项就拦下来。
- **33 套独立模板**：口播/头像、图片、视频、信息数据、风格片头、主题创意 6 类，每套有独立版式和动效。
- **Remotion 实时预览**：9 套模板用 `@remotion/player` 播放，可暂停、拖动、重播。
- **两种渲染路径**：HTML 模板逐帧渲染；视频改片支持 EDL 混剪和口播画中画。
- **本地声音链路**：MiniMax 声音克隆、逐句 TTS、ASR、BGM ducking、-16 LUFS 响度归一。
- **Agent 友好**：`AGENTS.md` + `skills/nutcut/SKILL.md`，安装后一句话接手项目。
- **中控台**：模板预览、项目详情、文案/声音/素材查看、问题记录、导出成片。
- **自动取素材**：`bin/capture-console.mjs` 可以截中控台和模板预览，直接当视频素材；Agent 自己有浏览器时，也可以直接截图，它只是可选的稳定复现方案。

## 技术栈

| 层 | 实际使用 |
|---|---|
| 运行时 | Node.js 20+，ES Modules |
| 中控台 | Node `http` + 原生 HTML/CSS/JS，无前端框架 |
| 模板 | HTML / CSS / Canvas，OpenMotion 模板合同 |
| 渲染 | Puppeteer-core + Chrome/Edge 逐帧截图，FFmpeg / FFprobe 合成 |
| Remotion | Remotion 4、React 19、`@remotion/player`、`@remotion/bundler`、`@remotion/renderer`、esbuild |
| AI | MiniMax Voice Clone、T2A `speech-2.8-turbo`、H3-Image、ASR `asr-1.0` |
| 数据 | 本地 JSON / MP4 / WAV，无数据库 |
| 测试 | Node.js 内置 test runner |

Remotion 目前用于**模板预览**，成片默认仍由 HTML 模板 + FFmpeg 渲染；详见 [docs/remotion.md](docs/remotion.md)。

## 环境要求

- Node.js 20+
- FFmpeg / FFprobe
- Chrome 或 Edge
- MiniMax Key：克隆用 `MINIMAX_API_KEY`；TTS / 生图 / ASR 用 `MINIMAX_PLAN_KEY`

## 快速开始

```bash
git clone https://github.com/N0tsLabs/nutcut.git
cd nutcut
npm install
cp .env.example .env      # Windows: copy .env.example .env
node bin/doctor.mjs
node console/server.mjs
```

打开 <http://127.0.0.1:4173>。

`doctor` 会区分必需项和可选能力：没有声音档案 / Key 时，仍然可以用原声或无配音项目开始。

## 使用

### 新建项目

模板只决定风格，必须显式给规格：

```bash
node bin/new-project.mjs --id my-video --title "我的视频" --template tech-neon \
  --orientation portrait --quality 1080p --fps 30 --duration 30 \
  --platform douyin --audio source
```

缺少横竖屏、尺寸、帧率或时长时，命令会拒绝创建，并列出需要先问用户的问题。

### 出片

```bash
node bin/voice.mjs --project projects/<id>
node bin/timeline.mjs --project projects/<id>
node bin/audio-mix.mjs --project projects/<id>
node bin/produce.mjs --project projects/<id>
```

### 生图

```bash
node bin/image-plan.mjs --project projects/<id> --dry-run
node bin/image-plan.mjs --project projects/<id>
```

生成结果写到 `projects/<id>/assets/generated/`，并自动写入 `presets/default.json` 的 `images`；模板里有 `data-image-slot` 的图片位会直接使用。

- 克隆：`MINIMAX_API_KEY`（按量计费）
- TTS / 生图 / ASR：`MINIMAX_PLAN_KEY`（Go 套餐，失败不回退余额）

### 模板与预览

```bash
node console/server.mjs
```

- 模板页支持 10 秒实时预览
- 带 `Remotion` 徽标的模板使用 Player 预览
- 带 Remotion 徽标的模板当前是 `previewOnly`，新建项目使用 HTML 版

### 视频改片

```bash
node bin/capture-console.mjs --out projects/<id>/assets/imported/ui --preview data-console
node bin/analyze-video.mjs --file "D:/素材/口播.mp4" --out projects/<id>/analysis
node bin/remix-plan.mjs --analysis projects/<id>/analysis/analysis.json --out projects/<id>/edl.json --title "标题"
node bin/assemble.mjs --edl projects/<id>/edl.json --out out/<id>/film.mp4
```

口播画中画：

```bash
node bin/frame-video.mjs --project projects/<id>
```

### 交给其他 Agent

```text
把 <仓库路径> 安装成你的 NutCut 技能，然后按它接手项目。
```

```bash
node bin/install-skill.mjs --target opencode
node bin/install-skill.mjs --target claude
node bin/install-skill.mjs --dest <agent-skills-dir>/nutcut --force
```

在 OpenCode 中从仓库根目录打开时，`opencode.json` 会自动发现 `skills/`。

### 自测

```bash
npm test                      # spec / 项目创建 / 技能 / doctor / API 门槛
node bin/check-templates.mjs  # 33 套 HTML 模板逐套渲染
node bin/doctor.mjs
```

## 目录结构

```text
NutCut/
  AGENTS.md              Agent 规则
  workflow.json          10 阶段工作流
  bin/                   渲染、声音、混音、项目、状态、安装脚本
  console/               本地中控台 + 项目详情页
  templates/             33 套 HTML 模板
  remotion/              9 套 Remotion 预览 composition
  skills/nutcut/         Agent 技能
  projects/              项目工程（JSON + src + 本地素材）
  docs/                  流程、Remotion、交接和风格文档
  test/                  自测
```

## 文档

- [Agent 接入](AGENTS.md)
- [新 Agent 30 秒启动](docs/agent-quickstart.md)
- [交接给其他 Agent](docs/agent-handoff.md)
- [视频制作流程](docs/video-workflow.md)
- [Remotion 预览与渲染](docs/remotion.md)
- [模板说明](templates/README.md)
- [风格参考](docs/style-references.md)

## 边界

- Remotion 预览目前不负责项目成片导出；成片走 HTML 模板。
- 不包含云渲染、在线协作、内置时间线剪辑器。
- `.env`、声音参考、用户素材、分析中间产物不提交仓库；交接时需要单独传。
- `library/` 只提交 catalog 和说明，音频文件不提交；本地使用请按来源自行放置。

## 许可

MIT，见 [LICENSE](LICENSE)。第三方素材与工具许可见 [NOTICE.md](NOTICE.md)。
