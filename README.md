# Slides Templates

按场合选择两套原生方案，不要求 Markdown 转 Beamer，也不强求同源内容。

| LaTeX · 正式报告 | Marp · 轻量分享 |
| --- | --- |
| [![LaTeX 实际封面](latex/thumbnail.png)](latex/README.md) | [![Marp 实际封面](marp/thumbnail.png)](marp/README.md) |
| 答辩、会议、复杂公式与引用 | 组内学习分享、论文讨论 |
| 复用 Beamer 文档类 `virgiling-slides.cls` | 复用 CSS 主题 `theme.css` |
| `.tex` → Tectonic → PDF | `.md` + theme → Marp CLI → HTML/PDF |
| [使用说明](latex/README.md) · [AI 规则](latex/AGENT.md) | [使用说明](marp/README.md) · [AI 规则](marp/AGENT.md) |

*缩略图来自真实编译封面，不是手绘示意。图片生成不代表进行了视觉模型检查。*

## 路由与边界

```text
template/                  # 独立 Git 仓库：只保存可复用模板/主题
├── .gitignore             # 两个子目录共享
├── AGENT.md
├── LICENSE.txt
├── README.md
├── latex/
│   ├── AGENT.md / README.md
│   ├── thumbnail.png
│   ├── example.tex
│   ├── references.bib
│   └── virgiling-slides.cls
└── marp/
    ├── AGENT.md / README.md
    ├── thumbnail.png
    ├── example.md
    ├── theme.css
    └── assets/workflow.svg
```

Marp 这一套的核心是 **theme**，不是自定义 HTML 播放器或应用脚手架。官方 `--template bespoke` / `bare` 是另一层概念，见 [Marp 说明](marp/README.md)。

依赖、Makefile、服务、测试和缩略图脚本由外层 `slides/` 管理；**本仓库不提交 `scripts/`**，也不把这些工具复制进报告。

## 单独使用

LaTeX：

```bash
cd latex
mkdir -p build
tectonic -X compile example.tex --outdir build --keep-logs --keep-intermediates --synctex
```

Marp（已安装 Marp CLI）：

```bash
cd marp
marp --theme theme.css example.md -o example.html
marp --theme theme.css --server --watch .
# http://localhost:8080/example.md
```

直接 server 会服务指定目录，仅在不含私有文件的演示目录中运行，不对公网开放。详细文档与官方来源见子目录 README。

## 在 slides 工作区使用

```bash
make install                            # 在 slides/，一次安装共享 Marp 工具
make new NAME=conference-talk TYPE=latex
make new NAME=group-sharing TYPE=marp
make serve SLIDE=group-sharing           # 显示可访问的 HTTP 预览 URL
make build SLIDE=group-sharing           # 导出 HTML + assets
make thumbnails                         # 更新这两张真实封面
```

不指定 TYPE 时，新建仍默认 LaTeX。新报告按入口识别类型，不复制 `.git/`、会话、日志、构建产物或依赖。

## 更新封面

外层工作区执行 `make thumbnails [TYPE=latex|marp]`，工具位于外层 `slides/scripts/`，使用临时目录编译并清理，只保留各模板的 `thumbnail.png`。

独立仓库也可直接使用原生命令：

```bash
# 在 latex/，先编译 example.tex，再取 PDF 第一页（需要 Poppler）
pdftoppm -f 1 -singlefile -png -scale-to-x 960 -scale-to-y 540 build/example.pdf thumbnail

# 在 marp/，导出实际封面（需要 Marp 支持的本地浏览器编译引擎）
marp --theme theme.css example.md --image png --image-scale 0.75 -o thumbnail.png
```

## 长期维护规则

先读 [`AGENT.md`](AGENT.md)，再读对应子目录的 `AGENT.md`。默认不用视觉模型，不调用浏览器工具；功能通过 API/CLI/HTTP/编译验证，外观待人反馈。

小步实现与验证，交付前将本次未推送变更 squash 为一个最终提交（每个独立仓库各一个），英文单行消息；保持线性历史，远端有新提交时 rebase，不自动发布。许可证见 [LICENSE.txt](LICENSE.txt)。
