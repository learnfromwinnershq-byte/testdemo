# A2 · 听叶家庭粤语听书

听叶是家庭私用的粤语听书 Web App。家长准备合法拥有的 PDF，孩子按章节收听，并通过逐句时间轴点击重听和续播。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

默认只允许本机访问：<http://localhost:3000/>。

如需让同一局域网内的设备访问，明确指定本机局域网 IP：

```bash
A2_ALLOWED_HOST=192.168.x.x npm run dev:lan
```

局域网模式会向同一网络开放家庭私有内容，只应在可信家庭网络中使用。

## 私有书籍数据

`public/books/`、`public/book-cover.png`、原始 PDF 和生成音频不进入 Git。当前本机数据可以直接运行；从 GitHub 重新取得源码后，需要自行恢复或重新生成这些文件。

提取带文字层的合法 PDF：

```bash
python scripts/extract-book.py --source /path/to/book.pdf
```

生成本机香港粤语音频与逐句时间轴（需要 macOS 系统语音、Xcode 命令行工具、`ffmpeg` 和 `jq`）：

```bash
zsh scripts/generate-book-audio.sh
```

## 验证

```bash
npm test
npm run build:static
```

`npm test` 会完成应用生产构建并检查首页的服务端渲染结果；`npm run build:static` 会生成供 yezi Nginx 容器使用的静态前端。

yezi 的 Docker 构建复制 `../site/` 中已发布的静态前端，并将本目录的 `public/books/` 以只读目录挂载到 `/learn/a2-tingye/books/`。更新应用时先运行 `npm run build:static`，再用新的 `static-dist/` 内容更新 `../site/`。因此首页的 A2 卡片可直接进入实际播放器，同时私有正文与音频仍不会进入 Git 或镜像。
