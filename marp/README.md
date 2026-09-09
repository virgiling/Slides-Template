# Marp · Virgiling Theme

[← 模板选择](../README.md) · [LaTeX 正式模板](../latex/README.md)

![Marp 实际封面](thumbnail.png)

*来自 `example.md` 的实际渲染封面，不是手绘示意。*

## 这里复用的是 theme，不是一套应用工程

按 [Marpit Theme CSS 文档](https://marpit.marp.app/theme-css)，主题就是 CSS：

```css
/* @theme virgiling */
@import 'default';

section { /* 每一页的字体、颜色、留白 */ }
h1 { /* 标题 */ }
section.lead { /* 封面版式 */ }
```

本目录的核心资产是 **`theme.css`**。`example.md` 只演示怎么使用它；没有自定义 Markdown 转换器、HTML 播放器、依赖包、测试框架或构建脚本。

| 概念 | 在这里对应什么 |
| --- | --- |
| **Theme** | `theme.css`：颜色、字体、留白、页脚、封面版式 |
| **Content** | `example.md`：示例内容；新报告编辑自己的 `slides.md` |
| **Directives** | Markdown 的 `theme`、`paginate`、`class`、`footer` 等 |
| **CLI template** | `--template bespoke` / `bare`：HTML 展示容器，不是视觉主题 |

CLI 默认的 `bespoke` 已提供翻页、全屏和演讲者视图，不需要再造播放器。来源：[Marp CLI · Template](https://github.com/marp-team/marp-cli#template)。

## 文件

```text
marp/
├── theme.css
├── example.md
├── assets/workflow.svg
├── thumbnail.png
├── README.md
└── AGENT.md
```

共享忽略规则和许可证位于模板仓库根目录。构建、server、测试和缩略图工具统一放在外层 `slides/`，**不属于这个主题**，也不复制进新报告。

## 在 slides 工作区使用

```bash
make install                              # 工作区只安装一次 Marp 工具
make serve                                # 预览主题示例
# 打开终端显示的 http://localhost:8080/example.md

make new NAME=group-sharing TYPE=marp
make serve SLIDE=group-sharing PORT=8080
# 打开 http://localhost:8080/slides.md

make build SLIDE=group-sharing             # 导出 HTML + assets 到 build/
make build SLIDE=group-sharing FORMAT=pdf  # 可选 PDF
make thumbnails TYPE=marp                  # 更新这个 README 的真实封面
```

`serve` 使用官方 server + watch 模式，提供 HTTP 预览与修改刷新；只同步选中报告、theme 和公开图片到临时服务目录，不暴露工作区或私有会话。退出时清理。不会自动打开浏览器。

## 单独使用 theme

安装 Marp CLI 后，从本目录运行：

```bash
marp --theme theme.css example.md -o example.html
marp --theme theme.css --server --watch .
# http://localhost:8080/example.md；PORT=5000 可改端口

marp --theme theme.css example.md --image png --image-scale 0.75 -o thumbnail.png
```

或者只把 `theme.css` 放进已有项目，执行：

```bash
marp --theme path/to/theme.css your-talk.md
```

用 `--theme-set` 注册 CSS 后，也能在 Markdown 中用 `theme: virgiling` 选择它。来源：[Marp CLI · Theme](https://github.com/marp-team/marp-cli#theme)。

单独启动官方 server 时，它会服务你指定的目录；**只在不含隐私文件的演示目录里运行**。服务器可能监听所有网卡，不要部署到公网。PDF/图片导出需要本地 Chrome/Edge/Firefox 编译引擎；可信本地图片需要 `--allow-local-files`。

## 内容写法

```markdown
---
marp: true
theme: virgiling
size: 16:9
paginate: true
math: katex
---

<!-- _class: lead -->
<!-- _paginate: false -->

# 封面

---

# 第一页内容

- 一个主要结论
```

- `---` 分页；`_` 前缀的 directive 只作用于当前页。
- 代码用 fenced block；公式用 `$...$` / `$$...$$`。
- 分栏图片：`![bg right:40% contain](assets/workflow.svg)`。
- 备注可用 HTML 注释，但可能进入演讲者视图，不能写入秘密。
- 主题使用 Linux Biolinum / MD IO，缺失时回退到系统字体；无需拷贝字体。

## 验证与官方资料

外层工作区执行 `bun run check`（API/CLI 渲染）和 `make test`（含 HTTP server 测试）。不使用浏览器工具或视觉模型检查外观。相关永久规则见根级及本目录 `AGENT.md`。

- [Theme CSS](https://marpit.marp.app/theme-css)：`@theme`、`section`、继承和页脚。
- [Directives](https://marpit.marp.app/directives)：主题选择、局部版式和分页。
- [Watch / Server mode](https://github.com/marp-team/marp-cli#conversion-modes)：watch 输出文件；server 按 HTTP 请求渲染。
- [封面图片导出](https://github.com/marp-team/marp-cli#title-slide)：`--image` 只导出第一页。
