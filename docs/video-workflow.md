# 视频制作流程

这条流程适用于“给我一段视频，做成一条能发的视频”，不再默认只有一种剪法。

## 0. 规格确认（第一件事）

模板只定义风格、配色和动效，不代表画幅。**在接收素材、写文案、渲染之前，必须先知道这条视频的基础规格。** 用户没说时，Agent 要反过来问：

1. 横屏 16:9 / 竖屏 9:16 / 方形 1:1？
2. 分辨率：1080p / 720p / 4K / 自定义宽高？
3. 帧率：24 / 25 / 30 / 50 / 60？
4. 目标时长多少秒？主要发在哪个平台？
5. 声音：保留原声 / 克隆配音 / 无人声？

写入 `projects/<id>/project.json` 和 `brief.json`：

```json
"spec": {
  "orientation": "portrait",
  "orientationLabel": "竖屏",
  "aspect": "9:16",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 30,
  "platform": "douyin",
  "audio": "source",
  "confirmed": true
}
```

- 没有 `spec` 或 `spec.confirmed !== true`：不要写文案、不要渲画面。
- 模板原生画布和目标画幅不同：`project.layoutAdapted = false`，先改 `src/index.html` 的版式，再跑 `node bin/adapt-layout.mjs --project projects/<id> --confirm`；没确认前 `produce` / `render` 会拒绝。
- 不要因为模板是竖屏设计就默认做竖屏，也不要因为用户要横屏就换风格。

命令行：

```bash
node bin/new-project.mjs --id <id> --title "标题" --template <模板> \
  --orientation <portrait|landscape|square> --quality 1080p --fps 30 --duration 30 --audio source
```

缺少规格时脚本会拒绝创建，并列出需要问用户的问题。

## 1. 接收素材

- 原视频、图片、音频、字幕、文案全部落在 `projects/<id>/assets/imported/`
- 先探针：时长、画幅、帧率、音轨、是否有人声
- 不覆盖用户原始素材

## 1.5 路径判断

- 用户只给模糊方向 → `research`，先联网调研
- 用户给了口播、产品、图片、视频、电视剧等明确素材 → `materials`，跳过调研

```bash
node bin/route.mjs --project projects/<id> --mode research --reason "用户只给了方向"
node bin/route.mjs --project projects/<id> --mode materials --reason "用户给了口播和素材"
```

无法判断时，用 `bin/ask.mjs` 问用户，不要替用户选。

## 1.6 联网调研（仅 research）

必须真实联网搜索，至少记录 3 个来源、findings 和 angles：

```json
{
  "question": "要回答的内容问题",
  "queries": ["搜索词 1", "搜索词 2"],
  "sources": [
    { "title": "来源标题", "url": "https://...", "publishedAt": "2026-01-01", "keyPoints": ["..."] }
  ],
  "findings": ["从资料里得出的结论"],
  "angles": [{ "title": "可拍角度", "why": "为什么适合用户", "risk": "风险" }]
}
```

写入 `projects/<id>/research.json`，然后：

```bash
node bin/research.mjs --project projects/<id> --check
node bin/confirm.mjs --project projects/<id> --step research
```

没有真实来源和用户确认，不进入 brief 和文案。

## 2. 素材分析

```bash
node bin/analyze-video.mjs --file <video> --out projects/<id>/analysis
```

产出：

- `analysis.json`：镜头、关键帧、静音、ASR、配音决策
- `asr.json`：逐字/逐句时间码
- `keyframes/`：每个镜头一张关键帧
- `voice.mode`：`source | clone | none`

## 3. 风格决策（必做）

分析完成后，Agent 先看素材，再和用户确认风格。**不要默认直接剪。**

推荐给用户的选择：

| 模式 | 说明 | 适合 |
|---|---|---|
| `overlay` 原片增强 | 视频保持全屏，只加字幕、包装、音效、配音 | 口播、访谈、已有完整剪辑 |
| `frame-motion` 模板画中画 | 视频是模板里的一个元素，位置/大小随章节变化，页面持续动效 | 竖屏口播、产品讲解、知识分享 |
| `remix-edl` 混剪/解说 | 按镜头重剪，插入 B-roll、电影片段，生成解说 EDL | 电影解说、多素材混剪、长视频 |

- `analysis.json` 会给出 `style.options` 和 `recommended`，但 **needsUserChoice 永远是 true**：

- 素材本身已经剪好、只是要包装 → 优先问是否 `overlay`
- 竖屏口播、产品讲解 → 优先问是否 `frame-motion`
- 长视频、多素材、电影解说 → 优先问是否 `remix-edl`

确认后写入：

```text
projects/<id>/style.json
```

示例：

```json
{
  "mode": "frame-motion",
  "label": "模板画中画（动态）",
  "decidedBy": "user",
  "constraints": {
    "showLogo": false,
    "mobileFirst": true,
    "minCaptionPx": 32,
    "safeMarginPx": 40,
    "maxCaptionLines": 2,
    "contentFocus": true,
    "videoMotion": true
  }
}
```

写完后不要自己开始做。把 2–3 个方案和推荐理由发给用户，等确认：

```bash
node bin/confirm.mjs --project projects/<id> --step style --note "用户确认 frame-motion"
```

需要用户选风格时，可以先把问题登记下来：

```bash
node bin/ask.mjs --project projects/<id> --question "想要哪种风格？" --options "overlay|frame-motion|remix-edl"
```

## 4. 结构设计

- 从视频内容里提取 4–6 个章节
- 每个章节对应真实讲解内容，不要加与素材无关的卡片
- 字幕从 ASR 逐句来，关键词高亮
- 标题来自视频主题，不写项目名、不写软件名

## 5. 版式与动效

### `overlay` 原片增强

- 原视频全屏
- 字幕、标题、贴纸、音效叠加
- 不重排视频，音画天然同步

### `frame-motion` 模板画中画

- 视频是页面里的一个元素，不是整页
- 每个章节使用不同布局：左 / 右 / 大 / 小
- 章节切换时视频位置和尺寸变化，页面保持动效
- 背景、章节标签、关键词、注释、圆点、字幕、进度条随视频变化
- 视频另一边必须始终有内容填充，不能出现核心区域大面积空白
- 不要固定在一个角落不动

### 通用动效规则

- 固定元素需要移动时，用 0.5–0.8 秒连续位移/缩放，不要直接闪过去
- A-roll 和 B-roll 如果共享同一个元素（头像、产品、手部、同一主体），优先用位置/尺寸连续过渡把它接过去
- 同一页面不要同时有多个主运动；背景可以慢，主体要有明确方向
- 视频作为元素时，位置变化要服务于内容章节，不要无意义来回跳

### `remix-edl` 混剪/解说

- 音轨和视频轨分离，按 EDL 切
- 必须做音画对轨检查
- 口播素材慎用，容易出现嘴型对不上

## 6. 竖屏可读性（硬规则）

720×1280 输出：

- 标题 ≥ 44px，900 字重
- 正文/字幕 ≥ 32px，900 或 700 字重
- 辅助标签 ≥ 12px
- 左右安全边距 ≥ 40px
- 底部进度条上方留 ≥ 60px
- 字幕最多 2 行，超长时优先换行，不缩到看不清
- 白底深字或深底白字，避免低对比渐变字
- 图片/视频窗口不要压住字幕

1080×1920 输出按 1.5 倍换算：字幕 ≥ 48px，标题 ≥ 66px，边距 ≥ 60px。

横屏 1920×1080：

- 标题 ≥ 72px
- 字幕 ≥ 42px
- 左右边距 ≥ 72px
- 不要把竖屏字号直接搬到横屏

## 7. 品牌与内容

- 默认不显示 NutCut Logo、软件名、水印；只有用户明确要求才加
- 不添加与视频内容无关的装饰卡片
- 标题、章节、标签必须来自素材内容
- 不编造产品功效、价格、优惠信息

## 8. 渲染与合成

```bash
# 口播画中画
node bin/frame-video.mjs --project projects/<id>
```

或：

```bash
# EDL 混剪
node bin/remix-plan.mjs --analysis ... --out ... --broll ...
node bin/assemble.mjs --edl ... --out ...
```

## 9. 交付前检查

- 音画同步：口播不切轨，或切轨后逐句检查
- 字幕：手机尺寸下能看清，最多 2 行
- 安全区：字幕不贴边、不被视频遮挡
- 品牌：没有多余 Logo/水印
- 内容：标题和章节来自素材，没有无关卡片
- 动效：视频不是固定在一个角落；章节切换有变化
- 响度：约 -16 LUFS
- 首帧/尾帧/转场无黑帧

## 当前示例

本地项目在 `projects/<id>/`，默认不提交到仓库。`frame-motion` 项目应包含：

- 视频窗口随章节切换位置和大小
- 原声保留或按 spec 配音
- 无 Logo / 水印
- 字幕符合安全字号和边距
- 横屏/黑边镜头自动模糊填充
