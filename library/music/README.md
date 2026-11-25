# NutCut 音乐库

本地 BGM 资源库，全部为 **CC0-1.0**，可商用、无需署名。

> 音频文件默认不提交到 Git（见根目录 `.gitignore`），仓库只保留 catalog 和来源说明。  
> 本地使用请按下方来源把曲目放到 `library/music/openlofi/`，再运行 `node bin/music-index.mjs`。

## openlofi

- 来源：[btahir/open-lofi](https://github.com/btahir/open-lofi)
- 许可：CC0-1.0
- 收录：**166 首**（完整曲库）
- 目录：`library/music/openlofi/`
- 元数据：`library/music/catalog.json`、`library/music/openlofi.catalog.json`
- 分类：
  - `ambient-lofi`：氛围、漂浮、电影感
  - `chillhop`：温暖、轻节拍
  - `jazzhop`：爵士、书店、夜晚
  - `hybrid`：片尾、世界、cinematic
  - `asian-lofi`：禅、茶室、东方
  - `activities`：工作、编码、学习、日常
  - `late-night`：夜晚、霓虹、城市
  - `soul-rnb`：慢拍、温暖、房间感
  - `funk-soul`：复古、律动、party
  - `seasonal-weather`：季节、雨、天气

## 远程 DURU

`remote.json` 保留 12 首 DURU-AI CC0 曲目，按需下载。适合 cinematic / explainer / dreamy / intro / world / lofi。

> 远程 raw 文件偶尔会被重置；`bin/music.mjs` 会回退到 `git clone` 缓存，首次较慢。

## 选择音乐

列出全部：

```bash
node bin/music.mjs --list
```

按标签 / 分类 / 情绪随机选：

```bash
node bin/music.mjs --random --tag ambient
node bin/music.mjs --random --category chillhop
node bin/music.mjs --random --mood cinematic
```

给项目选曲并写入 `out/<id>/bgm.mp3`：

```bash
node bin/music.mjs --project projects/ai-for-ordinary-people --random --tag ambient
node bin/music.mjs --project projects/ai-for-ordinary-people --remote --random --style cinematic
```

`audio-mix.mjs` 会自动优先使用 `out/<id>/bgm.mp3`，没有才回退到合成 ambient bed。

## 重建索引

新增本地曲目后：

```bash
node bin/music-index.mjs
```

## 关于抖音 BGM

GitHub 上的“抖音热门 BGM 合集”基本都是下载器或搬运仓库，音乐版权不属于分享者。拿来做成片会有版权风险。

这个仓库只收 CC0：

- Open Lo-Fi：166 首 lo-fi / chill / jazzhop / ambient；
- DURU-AI：12 首 cinematic / explainer / dreamy。

需要“抖音感”时，优先从 `activities`、`chillhop`、`funk-soul`、`late-night` 里选，而不是直接搬抖音热歌。
