# 把 NutCut 交给其他 Agent

这份文档只解决一件事：**怎么用最短的话，让另一个 Agent 正确接手这个项目。**

原则：一句话只负责“指路”，规则写在仓库里。不要把全部规范塞进 prompt，否则 `AGENTS.md` 一改，你发出去的旧 prompt 就过期了。

---

## 0. 安装成技能（推荐）

如果对方支持 skills（OpenCode、Claude Code、兼容 Agent），一句话就够：

> 把 `<仓库路径>` 安装成你的 NutCut 技能，然后按它接手项目。

Agent 会读 `skills/nutcut/SKILL.md`，把技能复制到自己的 skills 目录，再跑 `node bin/doctor.mjs`。

手动安装：

```bash
node bin/install-skill.mjs --target opencode   # ~/.config/opencode/skills/nutcut
node bin/install-skill.mjs --target claude     # ~/.claude/skills/nutcut
node bin/install-skill.mjs --target project    # <repo>/.opencode/skills/nutcut
node bin/install-skill.mjs --target all --force
node bin/install-skill.mjs --target all --force --clean-legacy
# 其他 Agent：装到它扫描的技能目录
node bin/install-skill.mjs --dest <agent-skills-dir>/nutcut --force
```

`--clean-legacy` 会删掉目标技能目录里旧的 `motion-smith` / `template-smith` / `voice-clone`，避免它们和 `nutcut` 抢任务。

在 OpenCode 里直接打开本仓库时，`opencode.json` 会自动发现 `skills/`，不需要额外安装；注意要从**仓库根目录**打开，`./skills` 是相对工作目录的。

---

## 1. 装好技能后的最短一句话

> 用 NutCut 技能接手 `projects/<id>`：先跑 `node bin/status.mjs`，读 `issues.json`，缺规格先问我。

不装技能、直接发长句也可以：

> 接手 `<仓库路径>` 的 NutCut 本地 AI 视频工作台：先读 `AGENTS.md`、`workflow.json`、`docs/agent-quickstart.md`，跑 `node bin/doctor.mjs` 和 `node bin/status.mjs --project projects/<id>`，读 `issues.json` 后继续；没有确认横竖屏/尺寸/帧率/时长就先问我。

如果只是让它先熟悉项目，不带具体任务：

> 先读 `<仓库路径>` 里的 `AGENTS.md`、`workflow.json`、`docs/agent-quickstart.md`，跑 `node bin/doctor.mjs`，然后告诉我这个项目现在能做什么、还缺什么，不要改文件。

---

## 2. 推荐开场（按场景选）

### 接手现有项目

> 接手 `<仓库路径>` 的 `projects/<id>`：先读 `AGENTS.md` 和 `docs/agent-handoff.md`，跑 `node bin/doctor.mjs`、`node bin/status.mjs --project projects/<id>`，再读 `projects/<id>/issues.json` 逐条处理。规格以 `project.json.spec` 为准；缺规格或规格不清楚时先问我，不要默认横竖屏。改完重新渲染，并更新 `issues.json`。

### 新做一条视频

> 在 `<仓库路径>` 新做一条视频：先读 `AGENTS.md` 和 `workflow.json`，跑 `node bin/doctor.mjs`。先问我横屏/竖屏/方形、尺寸、帧率、时长、平台和声音来源，写进 `project.spec` 后再新建项目；模板只决定风格，不要用模板原生画布推断画幅。

### 只改模板 / Remotion 预览

> 在 `<仓库路径>` 只改模板和预览：先读 `templates/README.md`、`docs/remotion.md`，改完跑 `node bin/check-templates.mjs` 和 `node bin/remotion-build.mjs --force`，再打开 `http://127.0.0.1:4173/#/templates` 验收。

### 审阅成片、只提修改意见

> 接手 `<仓库路径>` 的 `projects/<id>`：读 `AGENTS.md`、`project.json`、`issues.json`，先看 `out/<id>/film.mp4` 和字幕/规格，不要直接改文件；把问题和建议写回 `issues.json` 后等我确认。

---

## 3. 交接包里放什么

必须给：

- 仓库目录（或压缩包 / git 地址）
- 当前项目 id，例如 `projects/<id>`
- 这次要做什么：接手修改、重做、只审阅、只改模板
- 项目详情页里的问题记录，或直接给 `issues.json`

按需给：

- `.env`：包含 MiniMax Key，单独私聊发送，不要提交到仓库或公开链接
- `node_modules/`、`out/`、`.cache/`：可以不给，Agent 跑 `npm install` 和渲染会自己生成
- 原始素材：在 `projects/<id>/assets/imported/`，这个目录被 `.gitignore` 忽略，git clone 不会带上，必须单独传
- 视频分析：`projects/<id>/analysis/`，同样被忽略；没有它就要重新跑 `bin/analyze-video.mjs`
- 声音：`voices/me/reference.wav`、`voices/me/me.m4a` 被忽略；只交仓库的话，Agent 无法复刻同一音色，需要单独给参考音频或明确的 `voice_id`
- `voice-clone` 项目：确认 `voices/me/profile.json` 的 `voiceId` 是否可复用，不要重复克隆

注意：当前目录不是 git 仓库。要给别人时，建议先 `git init` 提交一版，或者打包时排除 `node_modules/`、`out/`、`.cache/`、`.env`。

`library/` 的音频文件默认已被 `.gitignore` 排除，仓库只提交 catalog 和说明。如果你想让交接包自带 BGM / 音效：
- 用 Git LFS 管理音频，或
- 单独打包 `library/music/openlofi/`、`library/sfx/` 给对方，再运行 `node bin/music-index.mjs` / `node bin/sfx-index.mjs`。

---

## 4. Agent 首轮应该做什么

1. 读 `AGENTS.md`、`workflow.json`、`docs/agent-quickstart.md`
2. 跑 `node bin/doctor.mjs`
3. 跑 `node bin/status.mjs --project projects/<id>`
4. 读 `projects/<id>/issues.json` 和 `project.json.spec`
5. 规格缺失或不完整时，先提问，不要开始写文案或渲染
6. 动手前先说明准备改哪些文件、跑哪些命令

---

## 5. 不要这样交接

- 只说“帮我看看这个项目”，不给项目 id
- 把几十条规则全塞进 prompt，和 `AGENTS.md` 重复
- 只给一条成片 MP4，不给工程目录
- 把 `.env` 或声音参考文件发到公开渠道

---

## 6. 验收看什么

- `node bin/status.mjs --project projects/<id>` 没有“规格未确认”
- `project.json.spec` 的横竖屏、尺寸、帧率、时长与实际成片一致
- `issues.json` 里用户的原话还在，已解决项有明确说明
- 重新导出的 `out/<id>/film.mp4` 能播放，字幕不溢出，没有 Logo/水印
- 模板改动跑过 `check-templates`，Remotion 改动跑过 `remotion-build`
