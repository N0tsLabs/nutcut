# NutCut 模板库

内置视频模板放在 `templates/<id>/`，当前 33 套，按 6 类分组。模板只定义风格、配色和动效，不绑定横屏或竖屏；横竖屏、尺寸、帧率、时长在新建项目时确认。

## 模板结构

```
templates/<id>/
  template.json        名称、分类、配色、字体、动效、stylePrompt、features
  motion.json          OpenMotion 清单
  src/index.html       window.renderFrame(frame, inputs)
  params.schema.json   参数合同
  presets/default.json 默认参数
  preview.png          16:9 预览图
  LICENSE
```

## 10 秒预览

中控台模板卡片上的「预览 10 秒」会打开实时预览：

- 10 秒模板：按自己的 0–10 秒线性播放，包含开场动画和 3 次转场
- 30 秒模板：从模板时间线抽取 4 个窗口，每个 2.5 秒，覆盖开场和 3 次转场
- 支持播放 / 暂停 / 拖动进度 / 重播
- 竖屏模板按真实比例居中预览，不再按 16:9 裁切
- 带 `Remotion` 徽标的模板用 `@remotion/player` 实时预览，不套 iframe
- 其余模板仍是 HTML iframe 预览，不依赖预先渲染视频

## 模板分类

`template.json` 用 `group` 分类，中控台模板页可以按分类筛选。当前 33 套：

- 口播/头像：`talk-frame`、`talk-corner`、`talk-split`、`talk-rail`、`talk-bubble`
- 图片素材：`photo-story`、`photo-grid`、`photo-quote`、`photo-split`
- 视频素材：`video-montage`、`video-pip`、`video-split`、`video-lowerthird`
- 信息数据：`data-console`、`science-paper`、`timeline-archive`、`finance-blue`、`blueprint-spec`
- 风格片头：`minimal-swiss`、`tech-neon`、`editorial-magazine`、`glass-3d`、`isometric-3d`、`type-rain`、`cyber-grid`
- 主题创意：`retro-vhs`、`pixel-arcade`、`paper-cut-festival`、`kids-crayon`、`comic-pop`、`nature-organic`、`warm-documentary`、`cursor-terminal`

## 信息模块

模板可以声明 `features`：

```json
{
  "features": ["table", "chart", "image-slot"]
}
```

- `table`：真实数据表，含表头和 4–6 行
- `chart`：柱状图 / 折线图 / 环形图 / 进度条组，随 frame 动画
- `image-slot`：图片预留位，元素带 `data-image-slot`

### 图片预留位

模板支持 `inputs.images`：

```json
{
  "images": [
    { "url": "/media/projects/xxx/assets/imported/photo-1.jpg", "alt": "现场照片" },
    { "url": "/media/projects/xxx/assets/imported/photo-2.jpg", "alt": "产品图" }
  ]
}
```

没有图片时显示「图片位 01 / 02」的占位图形；有图片时替换为图片。

## 模板列表

### 风格型

- `tech-neon` 科技霓虹
- `science-paper` 科普白板
- `comic-pop` 漫画分镜
- `warm-documentary` 温暖纪实
- `minimal-swiss` 极简瑞士
- `cyber-grid` 赛博网格
- `nature-organic` 自然有机
- `finance-blue` 金融蓝
- `retro-vhs` 复古录像带
- `kids-crayon` 儿童蜡笔

### 信息型

- `data-console` 数据驾驶舱：KPI、折线/柱状图、数据表、监控图片位
- `isometric-3d` 等距 3D：3D 卡片、参数表、产品图片位
- `editorial-magazine` 杂志跨页：大图位、分栏、跨页表格
- `timeline-archive` 时间线档案：年表、事件表格、档案图片位
- `glass-3d` 玻璃拟态 3D：玻璃面板、环形图、表格、图片位
- `blueprint-spec` 工程蓝图：蓝图网格、参数表、示意图、图片位

### 主题型

- `type-rain` 字雨：文字下落、词频表、数据图、图片位
- `cursor-terminal` 光标终端：逐字打字、日志表、延迟柱状图、截图位
- `pixel-arcade` 像素街机：像素标题、排行榜、方块柱状图、双图片位
- `paper-cut-festival` 剪纸节庆：红纸层叠、年节表、岁时时间轴、环形图、图片位

### 口播型

- `talk-frame` 口播画中画：视频随章节移动/缩放，另一侧关键词和章节填充，无 Logo（Remotion）
- `talk-corner` 头像角标：内容占主画面，圆形头像在角落平滑移动，近景放大
- `talk-split` 口播分屏：口播画面与内容分屏，换边时平滑滑过去
- `talk-rail` 口播侧栏：左侧固定章节栏，右侧视频 + 大字（Remotion）
- `talk-bubble` 口播气泡：头像气泡 + 2×2 内容卡（Remotion）

### 图片素材型

- `photo-story` 图片故事：全屏图片 + Ken Burns 推近 + 大字标题（Remotion）
- `photo-grid` 图片拼贴：2×2 多图，当前图片放大、其他退后
- `photo-quote` 图片引言：全屏图 + 超大金句 + 角落小图
- `photo-split` 图片分屏：上下双图斜切对比（Remotion）

### 视频素材型

- `video-montage` 视频混剪：8 拍硬切 + 镜头号 + 波形（Remotion）
- `video-pip` 视频画中画：主视频全屏，小窗在四角之间平滑移动/缩放
- `video-split` 视频双屏：左右两个视角，当前画面高亮
- `video-lowerthird` 视频下三分之一：全屏视频 + 左下信息条（Remotion）

## 动画规范

- 场景切换用 smoothstep 交叉淡化，约 0.7 秒，不要硬切
- 新模板统一使用 cubic-bezier(.16, 1, .3, 1) 做位移/缩放缓动
- 入场/出场用 ease-out / smoothstep / spring，不要线性直推
- 同一画面只保留一个主运动，避免同时位移、缩放、旋转
- 表格行、图表柱、数字滚动按 0.05–0.12 秒错峰
- 30fps 下不要依赖 CSS transition，全部由 `renderFrame` 按 frame 计算

## 功能矩阵

| 模板 | 表格 | 数据图 | 图片位 |
|---|---|---|---|
| 7 套风格型模板 | — | — | ✓（片尾图片位） |
| `data-console` | ✓ | ✓ | ✓ |
| `isometric-3d` | ✓ | ✓ | ✓ |
| `editorial-magazine` | ✓ | ✓ | ✓ |
| `timeline-archive` | ✓ | ✓ | ✓ |
| `glass-3d` | ✓ | ✓ | ✓ |
| `blueprint-spec` | ✓ | ✓ | ✓ |
| `type-rain` | ✓ | ✓ | ✓ |
| `cursor-terminal` | ✓ | ✓ | ✓ |
| `pixel-arcade` | ✓ | ✓ | ✓ |
| `paper-cut-festival` | ✓ | ✓ | ✓ |
| `talk-frame` | ✗ | ✗ | ✓（视频小窗） |

## 新增模板

1. 复制一个现有模板目录。
2. 改 `template.json` 的 id / name / category / palette / stylePrompt / features。
3. 改 `src/index.html` 的视觉和动画，保留 `window.renderFrame(frame, inputs)` 和 `window.__ready = true`。
4. 确认没有网络请求、`Date.now()`、`performance.now()`、`Math.random()`。
5. 渲染关键帧：

```bash
node bin/render.mjs --template templates/<id> --frames 0,120,300 --out out/check.png
```

6. 在中控台模板页检查 10 秒预览。

模板不要绑定横竖屏。`motion.json` 里的宽高只是原生设计画布；实际项目按 `project.spec` 的横屏/竖屏、尺寸和帧率渲染，必要时由 Agent 改编版式。

## Remotion 模板

9 套版式已有 Remotion composition，预览走 `@remotion/player`，不再套 iframe：

当前 `remotion.previewOnly` 默认为 `true`：它只负责概念预览，模板页新建项目和最终成片仍走 HTML 版；UI 的按钮会写成「用 HTML 版新建项目」。

```text
TalkFrame        talk-frame          1080×1920
TalkRail         talk-rail           1920×1080
TalkBubble       talk-bubble         1080×1920
PhotoStory       photo-story         1080×1920
PhotoSplit       photo-split         1080×1920
VideoMontage     video-montage       1920×1080
VideoLowerThird  video-lowerthird    1920×1080
DataConsole      data-console        1920×1080
KineticTitle     minimal-swiss       1920×1080
```

给模板加映射：

```json
"remotion": {
  "composition": "TalkFrame",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationInFrames": 300
}
```

- 宽高必须和 composition 设计尺寸一致
- `palette` 自动注入，不需要重复写
- 改完跑 `node bin/remotion-build.mjs --force`
- 渲染：`node bin/render-remotion.mjs --template templates/<id> --out out/a.mp4`
- 详细说明见 `docs/remotion.md`
