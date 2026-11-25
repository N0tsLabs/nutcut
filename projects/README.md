# Projects

这里是本地项目目录，默认不提交到 Git。

每个项目包含 `project.json`、`brief.json`、`script.json`、`issues.json`、模板副本和本地素材。用自己的机器运行：

```bash
node bin/new-project.mjs --id my-video --title "我的视频" --template tech-neon \
  --orientation portrait --quality 1080p --fps 30 --duration 30 --audio source
```

项目里的用户素材、声音参考和分析中间产物属于本地私有数据，不要提交到公开仓库。
