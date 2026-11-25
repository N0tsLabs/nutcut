# Remotion 预览与渲染

NutCut 的模板预览现在有两套引擎：

| 引擎 | 用途 | 入口 |
|---|---|---|
| HTML | 30+ 套内置模板的默认导出，仍是 `bin/render.mjs` | `templates/<id>/src/index.html` |
| Remotion | 9 套新设计语言，中控台实时预览 + 可选 MP4 渲染 | `remotion/` |

两套引擎并存，不是二选一。HTML 模板继续走「Puppeteer 逐帧截图 + FFmpeg」，Remotion 模板走「React + Player + renderer」。

模板只定义风格和配色；composition 的 `1080×1920` / `1920×1080` 只是预览画布。项目实际横竖屏以 `project.spec` 为准，不要用 composition 尺寸反推用户需求。

当前 `template.json.remotion.previewOnly` 默认是 `true`：Remotion 只负责概念预览，创建项目和成片导出仍走 HTML 模板。UI 和 API 都会带这个标记，Agent 不要把它当成最终导出引擎。

---

## 1. 为什么只做预览

Remotion 的优势是时间线、音画同步和组件化，但把 30+ 套模板一次性重写风险太大。当前策略：

- 先用 9 套旗舰版式验证 Remotion 的视觉、性能和维护成本
- 中控台模板页对已映射的模板显示 `Remotion` 徽标，预览走 Player
- 其他模板继续用 HTML 预览，行为不变
- 成片导出仍默认走 HTML 引擎，Remotion 渲染是显式命令，不偷偷切换

迁移顺序建议：口播/头像 → 视频素材 → 图片素材 → 信息数据 → 风格片头 → 主题创意。

---

## 2. 目录

```text
remotion/
  index.ts                 registerRoot（renderer 用）
  Root.tsx                 注册所有 composition
  entry.tsx                Player 入口，挂到 window.NutCutRemotion
  registry.ts              composition 清单：组件、默认 props、宽高、帧数
  types.ts                 共用 props 类型
  lib/theme.ts             从 template.json palette 生成主题
  lib/anim.ts              贝塞尔、场景交叉淡化、连续位移
  components/Placeholder.tsx 纯色占位、网格、进度条
  compositions/             9 套版式
```

产物：

- `console/ui/remotion-player.js`：esbuild 打包的 IIFE，已压缩，约 640KB
- `.cache/remotion-bundle/`：renderer 用的 composition bundle
- `.cache/tmp/`：Remotion 渲染临时目录

`console/ui/remotion-player.js` 和 `.cache/` 都是生成物，不提交。

---

## 3. 中控台预览

打开模板页，带 `Remotion` 徽标的模板点「预览 10 秒」：

- 使用真实 composition 宽高，竖屏弹窗会自动收窄
- Player 直接跑在页面里，不套 iframe
- 播放 / 暂停 / 重播 / 拖动进度条都走同一个 Player 实例
- 关闭时卸载 React root，不会卡住下一个预览
- 模板的 `palette` 会作为 `inputProps.palette` 传入，所以 9 套版式各自保留配色

如果 `remotion-player.js` 缺失或加载失败，会自动回退到 HTML 预览，不会白屏。

启动 `node console/server.mjs` 时会检查 Player 是否过期，过期就自动重打。

---

## 4. composition 清单

| composition | 尺寸 | 模板 | 版式 |
|---|---|---|---|
| `TalkFrame` | 1080×1920 | `talk-frame` | 口播画中画，视频窗口随章节连续移动 |
| `TalkRail` | 1920×1080 | `talk-rail` | 左侧固定章节栏，右侧视频 + 大字 |
| `TalkBubble` | 1080×1920 | `talk-bubble` | 头像气泡 + 四张内容卡 |
| `PhotoStory` | 1080×1920 | `photo-story` | 全屏图片故事，右侧缩略图轨 |
| `PhotoSplit` | 1080×1920 | `photo-split` | 上下双图斜切对比 |
| `VideoMontage` | 1920×1080 | `video-montage` | 8 拍混剪，镜头号 + 波形 + 时间线 |
| `VideoLowerThird` | 1920×1080 | `video-lowerthird` | 全屏视频 + 下三分之一 |
| `DataConsole` | 1920×1080 | `data-console` | 指标卡 + 柱状图 + 表格 |
| `KineticTitle` | 1920×1080 | `minimal-swiss` | 超大字号片头，逐行遮罩揭示 |

全部 10 秒 / 30fps / 300 帧，4 个章节，场景切换 0.4 秒交叉淡化。

---

## 5. 给模板加 Remotion

在 `templates/<id>/template.json` 增加：

```json
{
  "remotion": {
    "composition": "TalkFrame",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationInFrames": 300,
    "props": {
      "title": "冬天护手计划"
    }
  }
}
```

- `width` / `height` 必须和 composition 设计尺寸一致，不能照抄 `motion.json`
- `props.palette` 会自动取 `template.json.palette`，不用重复写
- `props` 里的 `chapters` / `captions` / `title` 会覆盖 composition 默认文案
- 没有 `remotion` 字段的模板继续走 HTML 预览

---

## 6. 渲染成片

```bash
# 用模板映射的 composition
node bin/render-remotion.mjs --template templates/talk-frame --out out/talk-frame.mp4

# 直接指定 composition + props
node bin/render-remotion.mjs --composition DataConsole --out out/data.mp4 \
  --props '{"title":"本周数据"}'

# 只渲一帧
node bin/render-remotion.mjs --template templates/photo-story --still 120 --out out/story.png

# 强制重打 composition bundle
node bin/render-remotion.mjs --template templates/talk-frame --out out/a.mp4 --rebuild
```

参数：

- `--props`：JSON 文件或内联 JSON
- `--still <frame>`：渲单帧 PNG
- `--browser`：指定 Chrome / Edge 可执行文件
- `--concurrency`：并发标签页数
- `--log info|verbose`：排查渲染问题

渲染临时目录固定在 `.cache/tmp`，可通过 `NUTCUT_TEMP_DIR` 覆盖。原因是 Windows 沙箱 / 杀软可能拒绝 Remotion 自带 ffmpeg 写入系统 `%TEMP%`，表现为 `Permission denied` 或 `write EOF`。

---

## 7. 动效规则

和 `templates/README.md` 一致：

- 位移 / 缩放进场：`cubic-bezier(.16, 1, .3, 1)`
- 场景切换：0.4 秒交叉淡化，不用硬切
- 共享元素（视频窗口、头像）跨章节连续过渡，不闪
- 固定元素只在内容需要时移动一次，不逐句抖
- 禁止 `Date.now()`、`performance.now()`、`Math.random()` 参与画面
- 所有演示数据、占位色都是确定的

---

## 8. 授权

Remotion 对个人和 ≤3 人的团队免费；更大的团队需要 Company License。介人商业产品前先确认公司规模，不要假设它和 MIT 一样。

- License 说明：<https://www.remotion.dev/docs/license/pricing>
- NutCut 本身不内置 Editor Starter，也没有引入 Remotion Studio 的编辑器功能。
