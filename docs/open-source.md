# 开源前检查

> 目标：别人 clone 后能跑起来，Agent 能读懂流程，同时不泄露声音、密钥和用户素材。

---

## 1. 不能提交的内容

`.gitignore` 已覆盖：

- `.env`（MiniMax Key）
- `node_modules/`
- `out/`（成片、混音、逐帧）
- `voices/*/reference.wav`、`voices/*/*.m4a`（生物特征数据）
- `projects/*/assets/imported/`（用户素材）
- `voices/*/profile.json`、`library/music/openlofi/`、`library/sfx/*` 音频文件

clone 后需要自己提供：

- `voices/me/me.m4a`
- `voices/me/reference.wav`
- `voices/me/profile.json`
- `.env`

---

## 2. 许可证

- 代码：MIT（根目录 `LICENSE`）
- 模板：MIT / CC0-1.0，见各模板 `LICENSE`
- BGM：Open Lo-Fi / DURU-AI，CC0
- SFX：motion-graphics / Built to Click / Meta Open Sound / Kenney，CC0
- 风格参考：Code Animation Prompts，只借鉴分类和方向；原合集免费分享，禁止付费包装
- 项目成片和用户素材：不要默认随仓库分发

---

## 3. 大文件

`.gitignore` 已排除 `library/music/openlofi/`、`library/music/remote/` 和 `library/sfx/` 下的音频，仓库只保留 catalog 和来源说明。

如果你 fork 后想自带曲库：

1. 用 Git LFS 存 BGM；
2. 或保持默认，让使用者按 `library/*/README.md` 的来源自己放文件。

不建议把 500MB+ MP3 直接放进普通 git 历史。

---

## 4. Agent 可读性

已提供：

- `AGENTS.md`：总规则
- `workflow.json`：13 阶段输入 / 输出 / 检查点
- `docs/agent-quickstart.md`：clone 后怎么跑
- `docs/04-topic-research.md`：选题、素材、可行性
- `bin/doctor.mjs`：环境检查
- `bin/status.mjs`：项目状态 + 下一步
- `bin/new-project.mjs`：模板建项目
- `bin/import.mjs`：导入用户素材

新 Agent 的推荐顺序：

```bash
node bin/doctor.mjs
node bin/status.mjs --project projects/<id>
cat workflow.json
```

---

## 5. 发布前清单

- [x] 根目录有 `LICENSE`
- [x] `NOTICE.md` 列出 CC0 来源
- [x] `.env` 没有提交
- [x] `voices/` 没有提交真实声音
- [x] `projects/*/assets/imported/` 没有提交用户素材
- [x] `out/` 没有提交大视频
- [x] `library/` 音频没有提交
- [ ] `node bin/doctor.mjs` 在干净环境通过
- [ ] 随机挑一套模板，`node bin/render.mjs --frames 0,120` 能出图
- [ ] 新建项目 → 写文案 → 生成声音 → 导出，全流程能跑
