# 本地声音档案

MiniMax 的声音复刻是“**上传参考音频 → 克隆出持久 `voice_id` → 后续用 `voice_id` 合成**”。
本地档案把这些信息收在 `voices/<id>/profile.json`；项目里对外的名字始终是 `me`。

## me

```
voices/me/
  me.m4a           # 原始录音（源文件，就叫 me）
  reference.wav    # 给 TTS 的参考，只裁头尾
  profile.json     # 本地档案 + MiniMax 远程 voice_id
```

- 参考音频：`voices/me/reference.wav`（13.4s，24kHz 单声道）
- 原始录音：`voices/me/me.m4a`
- 裁切：`0.90s–14.30s`，**只裁头尾；中间停顿、气息、节奏完全保留**
- MiniMax 远程 `voice_id`：保存在 `profile.json` 的 `minimax.voiceId`
- 不要再重复克隆；后续合成直接复用

## 生成

```bash
node bin/voice.mjs --project projects/ai-for-ordinary-people
```

只测试一句，不重克隆：

```bash
node bin/voice.mjs --project projects/ai-for-ordinary-people --test
```

输出：

```
out/<project>/vo/01.wav …
out/<project>/voice-preview.mp3
out/<project>/manifest.json
```

## 环境变量

```bash
MINIMAX_API_KEY=按量计费Key      # 只用于上传/克隆
MINIMAX_PLAN_KEY=Go订阅Key       # 只用于 T2A 合成，走套餐额度
MINIMAX_BASE_URL=https://api.minimax.cn/v1
MINIMAX_TTS_KEY=plan             # 默认合成只走 Go 套餐，不回退余额
```

- `MINIMAX_API_KEY` 与 `MINIMAX_PLAN_KEY` 不能混用
- 克隆 10 秒–5 分钟，≤20MB；克隆音色 7 天未使用会被删除
- 如果报 `2061 voice_clone`：当前 Key/套餐不含快速复刻
- 如果报 `1008 insufficient balance`：Key 权限对了，只差余额
- 如果报 `2038`：账号未完成实名/企业认证

## 图片

MiniMax-H3-Image 文生图默认也走 Go 套餐：

```bash
node bin/image.mjs --project projects/<id> --name hero \
  --prompt "极简编辑设计的电影感画面，深绿色工作台，纸张与声波线，暖色侧光，16:9"
```

输出到 `projects/<id>/assets/generated/`；如果 Go 套餐不支持或额度不足，会直接报错，不会回退余额。
