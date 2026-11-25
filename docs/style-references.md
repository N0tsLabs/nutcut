# 代码动画风格参考

> 参考来源：[XiaoyeCodes/code-animation-prompts](https://github.com/XiaoyeCodes/code-animation-prompts)（341 种代码动画风格提示词 / 196 张参考静帧）。
>
> 我们借鉴的是**风格分类和组织方式**，不是复制原始提示词。原合集免费分享，禁止包装成付费课程或付费 skill 销售。
>
> NutCut 的差别：他们主要交付“提示词”，我们直接交付**可渲染的 HTML 模板、时间线、声音和成片**。风格参考用来决定方向，模板负责落地。

---

## 怎么用

1. 先读 `templates/style-catalog.json`，选 1–3 个风格参考。
2. 看 `closestTemplate`，优先用现成模板。
3. 现成模板不够时，按参考的 `visual` / `motion` / `palette` 新写模板。
4. 信息型内容必须考虑：`table`、`chart`、`image-slot`。
5. 渲染关键帧验证，再进中控台 10 秒预览。

---

## 风格分类

| 类别 | 参考编号 | 适合内容 | 我们对应的模板 |
|---|---|---|---|
| 文字动态 | A1 字雨、A2 光标打字、A3 大字冲击、A4 字的隧道、A5 字散再聚 | 片头、金句、AI、科技 | `tech-neon`、`minimal-swiss`、`cyber-grid` |
| 粒子光效 | B1 流动丝线、B2 萤火光尘、B3 粒子聚形、B4 星空连线 | 情绪、AI、系统、片头 | `tech-neon`、`cyber-grid`、`nature-organic` |
| 国风 | C1 水墨、Z1 水墨、Z5 剪纸、Z8 敦煌 | 文化、节气、品牌 | `nature-organic` |
| 氛围 | D1 雨窗、D2 窗光与尘、D3 雪与火星 | 纪实、生活、品牌故事 | `warm-documentary` |
| 极简 | E1 极简几何、E3 字符画 | 观点、设计、实验 | `minimal-swiss`、`cyber-grid` |
| 数据信息 | F1 图表生长、F2 关系图、F3 分屏对比 | 数据、系统、评测 | `data-console`、`finance-blue`、`cyber-grid` |
| 复古/故障 | G1 老胶片、G2 信号故障、K28 像素 | 怀旧、音乐、潮流 | `retro-vhs` |
| 版式 | H1 Biennale Yellow、H3 Blue Professional、H4 Bold Poster | 品牌、活动、报告 | `minimal-swiss`、`finance-blue`、`editorial-magazine` |
| 漫画 | K6 清线漫画、K13 美漫网点、K14 波普 | 故事、观点、娱乐 | `comic-pop` |
| 科普 | M1 白板手绘、K10 粉笔黑板、M18 数学/科学讲解 | 知识、教程、原理 | `science-paper`、`data-console` |
| 材质/3D | K21 手工纸艺、K24 粘土、K25 皮克斯式 3D、K27 低多边形 | 儿童、产品、故事 | `kids-crayon`、`isometric-3d`、`glass-3d` |
| 时间线/新闻 | M20 时间线、M34 新闻快讯 | 历史、盘点、资讯 | `timeline-archive`、`data-console` |

---

## 高价值参考

### A1 字雨

- 视觉：文字像雨一样下落、堆叠、冲刷。
- 动效：下落、加速、碰撞、突然静止。
- 落地：适合 3 秒钩子、关键词、科技片头。
- 可加到：`tech-neon` 的片头场景。

### A2 光标打字

- 视觉：终端/编辑器、逐字敲出、状态行、日志。
- 动效：逐字、光标、滚动、状态切换。
- 落地：AI 能力、编程、教程、产品演示。
- 可加到：`tech-neon` 的第二幕。

### A3 大字冲击

- 视觉：超大粗黑字占满画面，单一强调色。
- 动效：砸入、放大、抖动、留白。
- 落地：观点、口号、短视频钩子。
- 可加到：`minimal-swiss`。

### B3 粒子聚形

- 视觉：粒子从散乱聚成文字/产品轮廓。
- 动效：聚形、形变、爆散、重组。
- 落地：AI、概念、发布片。
- 可加到：`tech-neon` 或新模板。

### F1 图表生长

- 视觉：柱子生长、折线延伸、数字滚动、KPI 卡。
- 动效：生长、注释出现、对比切换。
- 落地：数据、财报、科普、商业。
- 已落地：`data-console`。

### H1 Biennale Yellow / H3 Blue Professional

- 视觉：展览海报式排版 / 深蓝商务数据。
- 动效：版式切换、色块滑入、卡片进入。
- 落地：品牌、活动、B 端报告。
- 已落地：`minimal-swiss`、`finance-blue`、`editorial-magazine`。

### K25 皮克斯式 3D / K27 低多边形

- 视觉：圆润 3D / 几何切面、等距视角。
- 动效：镜头推进、组装、环绕。
- 落地：故事、产品、科技。
- 已落地：`isometric-3d`、`glass-3d`。

### K28 像素

- 视觉：8-bit 像素、有限色板、游戏 UI。
- 动效：逐格、对话框、像素化。
- 落地：游戏、怀旧、年轻内容。
- 已落地：`pixel-arcade`。

### Z5 剪纸

- 视觉：红纸剪纸、层叠、民俗纹样。
- 动效：展开、层叠、旋转。
- 落地：节日、国风、祝福。
- 已落地：`paper-cut-festival`。

---

## 新增模板时的检查

- 是否有明确的视觉语言，而不是只换颜色？
- 是否有 3 种以上入场/出场动画？
- 是否有 3 次以上转场？
- 信息型模板是否有表格 / 数据图 / 图片位？
- 是否确定性渲染，无 `Math.random` / `Date.now` / 网络请求？
- 10 秒预览是否能看出风格？

---

## 许可

- 原始合集：免费使用、免费分享；禁止包装成付费课程、付费 skill 或任何收费产品。
- NutCut 只使用风格名称、分类和方向，不复制原始提示词全文。
- 如果引用具体风格，保留编号和来源链接。
