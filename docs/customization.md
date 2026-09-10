# 修改字体与样式

[← 模板首页](../README.md) · [安装与操作](setup.md) · [终端预览](terminal.md)

下面路径以初始化后的外层 `slides/` 为起点。**幻灯片字体与网页终端字体是两套配置**，改一处不会自动改变另一处。不要修改个人 Ghostty 配置来调整网页终端。

## 默认字体与安装

| 区域 | 默认字体 | 说明 |
| --- | --- | --- |
| 正文 | Linux Biolinum | 中文回退 PingFang SC / Noto Sans CJK SC |
| 数学 | Cambria Math | Marp 使用 `math: katex` 与共享 engine 的原生 MathML；回退 STIX Two Math |
| 代码 | MD IO | 需要系统安装；HTML 接收者缺少时使用回退字体 |
| 网页终端图标 | Symbols Nerd Font Mono | 补充 `eza --icons` 等 Nerd Font 私用区字形 |

从字体的官方/合法来源获取并安装到操作系统，不把字体文件放进模板或报告。可以选择自己有权使用的替代字体。字体名称必须使用安装后的 **family name**，不一定等于字体文件名。

安装了 Fontconfig 时，可用 `fc-match 'MD IO'`、`fc-match 'Symbols Nerd Font Mono'` 辅助检查；注意它可能返回替代字体，且不代表浏览器实际选择的字体。字体安装后若未生效，刷新页面，必要时重启浏览器。

## Marp 幻灯片

修改当前报告的 `<talk>/theme.css`，不要为了某份报告覆盖模板示例：

- `section` 的 `font-family`：正文与中文回退。
- `math` 的 `font-family`：数学字体，应选支持 OpenType Math 的字体。
- 代码相关规则的 `font-family`：代码字体。

例如保持 MD IO 并提供跨平台回退：

```css
font-family: "MD IO", "SFMono-Regular", Consolas, monospace;
```

若要改变**之后新建报告的默认样式**，修改 `template/marp/theme.css`；旧报告是副本，不会自动改变。

数学需保留 `math: katex` 并通过共享 engine 构建，才能使用原生 MathML 字体。`math: mathjax` 使用 MathJax 自己的 SVG 字体，不是 Cambria Math。不要通过替换 KaTeX HTML 内部字体强行模拟数学排版。

其他常用修改：

- Markdown frontmatter 的 `footer`：姓名与短标题；`paginate: true` 开启页码。
- 封面的 `<!-- _paginate: false -->`：隐藏该页页码，但封面仍计入总页数。
- `theme.css` 的蓝色 `#015CAD` / `#003865`：结构色与底部色带；不要重新引入顶部色带。
- 图片页使用 `<!-- _class: image-split -->`，避免用巨大固定宽度把图注挤出页面。
- AIGC 标识和图片规则见 [Marp 使用说明](../marp/README.md)。

CSS/Markdown 在 `make serve` 中实时更新。字体或布局改动后应真实构建；HTML 测试通过不代表 PDF 没有溢出。PDF 字体可用 `pdffonts <talk>/build/slides.pdf` 检查。

## LaTeX / Beamer

修改报告副本的 `<talk>/virgiling-slides.cls` 中正文的 fontspec 字体设置、`\setmathfont{Cambria Math}` 和 `\setmonofont{MD IO}`。若替换整个字体家族，也需同步检查 Regular/Bold/Italic/Bold Italic 等显式变体设置，不能只改一个名字。

仅想覆盖正文样式时，可在 `main.tex` 导言区使用 fontspec 的标准命令；数学字体通过 `\setmathfont` 设置。重新运行 `make build SLIDE=<talk>`，检查本次编译日志中的 missing font / missing character / overfull 警告，并用 `pdffonts` 检查输出。模板默认所需字体及命令见 [LaTeX 说明](../latex/README.md)。

## 网页终端

修改外层 `scripts/terminal-backend.cjs` 中传给 ttyd 的 client options：

```text
fontFamily=MD IO, Symbols Nerd Font Mono, Menlo, monospace
fontSize=14
minimumContrastRatio=4.5
```

- 普通文字优先 MD IO；缺少的 Nerd Font 图标由 Symbols Nerd Font Mono 补齐。`eza --icons` 显示方框通常是字体缺字，不能据此认定 ttyd 不支持 Unicode。
- `terminalTheme` 设置文字、光标和 ANSI 调色板；当前保留深暖棕正文和加深的彩色文字。
- 外层 `scripts/preview-drawer.css` 设置抽屉底色、透明度、圆角和模糊程度；当前灰白底为 `rgb(232 232 232 / 88%)`。
- 原生画布使用 `allowTransparency=true` 和 `background: "#e8e8e800"`。最后的 `00` 是 alpha；写成 `#fff` 会变成实色白底。调整玻璃颜色时，也同步该 RGB，使终端的浅色背景检测保持一致。
- 不要给整个 iframe/终端容器设置 `opacity`，否则文字也会一起变淡；不要 blur 文字本身。
- 应用自行绘制的 ANSI/真彩色背景仍由应用决定，可选择该应用的浅色主题。

共享脚本及 ttyd 参数修改后，**Ctrl-C 停止旧 `make serve`，重新启动并刷新**。不需要删除 Zellij 会话或重启正在运行的 Agent。维护分发版本时，记得执行 `python3 scripts/package-bootstrap.py` 更新初始化资源。
