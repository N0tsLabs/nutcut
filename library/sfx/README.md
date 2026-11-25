# NutCut 音效库

本地 CC0 音效库，共 **609** 个文件，全部可商用。中控台「素材 → 音效」页可以直接试听、搜索和按类别筛选。

> 音频文件默认不提交到 Git（见根目录 `.gitignore`），仓库只保留 catalog 和来源说明。  
> 本地使用请按下方来源把文件放到对应目录，再运行 `node bin/sfx-index.mjs`。

## 来源

| 目录 | 数量 | 来源 | 许可 |
|---|---:|---|---|
| `motion/` | 107 | [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) | CC0-1.0 |
| `codebank/` | 306 | [Builttoclick/video-editing-playbook](https://github.com/Builttoclick/video-editing-playbook) | CC0-1.0 |
| `meta/` | 181 | [facebookincubator/Meta-open-sound](https://github.com/facebookincubator/Meta-open-sound) | CC0-1.0 |
| `kenney/` | 15 | [kenney.nl](https://kenney.nl/assets) | CC0-1.0 |

- `codebank` 是 Built to Click 用代码合成的短视频音效库，包含 whoosh、riser、pop、click、glitch、typing、notify、logo sting 等，最适合抖音/短视频节奏。
- `meta` 是 Meta Oculus Audio Pack 的真实录音子集，包含翻书、纸张、开关、门、金属/陶瓷碰撞、环境底噪、雨声、城市、人群等。
- `motion` 是 motion-graphics 的 CC0 套件，包含 whoosh、riser、pop、glitch、typing、tick、ambience 等。
- `kenney` 保留少量经典 UI / impact / click。

## 分类

| 分类 | 数量 | 用途 |
|---|---:|---|
| `transition` | 118 | 转场 whoosh、swoosh、riser、downlifter、swipe |
| `impact` | 109 | 冲击、敲击、门、碰撞、sub drop |
| `tick` | 92 | 点击、开关、键盘、时钟 |
| `pop` | 61 | 弹出、气泡、chip、pop-in |
| `notify` | 39 | 通知、提示音、ding |
| `typing` | 23 | 键盘打字 |
| `glitch` | 22 | 数字故障、信号干扰 |
| `ui` | 112 | UI blip、stinger、countup、powerup |
| `foley` | 18 | 翻书、纸张、布料、脚步 |
| `ambience` | 15 | 房间底噪、城市、雨、森林、人群、水声 |

混音器会自动使用 `out/<id>/sfx/` 下的 `transition.*`、`impact.*`、`tick.*`。

## 重建索引

新增或删除文件后：

```bash
node bin/sfx-index.mjs
```

会重新扫描四个来源目录，补齐 `path`、`duration`、`tags`，并写入 `library/sfx/catalog.json`。

## 选择音效

```bash
node bin/sfx.mjs --list
node bin/sfx.mjs --list --category transition
node bin/sfx.mjs --project projects/ai-for-ordinary-people --set default
node bin/sfx.mjs --project projects/ai-for-ordinary-people --kind transition --random --tag whoosh
node bin/sfx.mjs --project projects/ai-for-ordinary-people --kind impact --id codebank-bank-whoosh-big-tonal
```

会复制到：

```
out/<id>/sfx/transition.<ext>
out/<id>/sfx/impact.<ext>
out/<id>/sfx/tick.<ext>
```

## 关于剪映 / 抖音音效库

剪映和抖音内置音效属于字节跳动的版权素材。GitHub 上流传的“剪映音效 2174 款”“抖音热门音效合集”基本是搬运或破解包，公开可下载不等于可以商用。

这个仓库不收录这类文件，而是用 CC0 的短视频音效库替代：

- `codebank`：最接近抖音剪辑节奏的 whoosh / pop / glitch / riser；
- `meta`：真实翻书、开关、纸张、环境声；
- `motion`：motion graphics 转场与 UI。

如果只是本地个人玩，可以自己从剪映导出音效，但不要提交到仓库或用于商用成片。

## 规则

- 只收录 CC0 / 公共领域或明确允许商用的音效；
- 每个文件记录 `license`、`source`、`attribution`；
- 不要把版权不明的影视/游戏/剪映音效放进来。
