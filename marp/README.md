# Marp · Virgiling Theme

[← 模板首页](../README.md) · [安装工作区](../docs/setup.md) · [字体与样式](../docs/customization.md)

![Marp 实际封面](thumbnail.png)

本目录提供 CSS theme、Markdown 示例与素材。使用原生 Marp/Bespoke 播放器；`--template bespoke` / `bare` 指播放器，**不是**这里的 `theme.css`。

## 运行与导出

单独克隆后先按[根 README](../README.md#只克隆这个仓库如何运行)初始化，完整工具会生成到外层 `slides/`，包括 callout / MathML engine，不再依赖另一个未提供的仓库。

在外层 `slides/`：

```bash
make install
make build-template TYPE=marp               # template/marp/build/example.html
make serve                                 # 看模板示例
make new NAME=group-sharing TYPE=marp
make serve SLIDE=group-sharing
make build SLIDE=group-sharing              # group-sharing/build/slides.html + assets/
make build SLIDE=group-sharing FORMAT=pdf
```

编辑报告副本的 `slides.md` / `theme.css`，不覆盖模板示例。共享脚本改动后重启 `make serve`；Markdown、CSS 和公开图片可热更新。输出 HTML 时分享整个 `build/`。

基础 CSS 也可直接用于已安装的普通 Marp CLI：

```bash
marp --theme path/to/theme.css your-talk.md
```

但**普通 CLI 不解析本示例的 `[!aigc]` / callout 扩展，也不自动启用本项目的 MathML/键位路径**。完整效果请使用初始化后的 Make 命令；不要把降级命令当作完整示例的构建方式。

## 页面格式与 AIGC

一份完整报告的 frontmatter 示例：

```markdown
---
marp: true
theme: virgiling
size: 16:9
paginate: true
math: katex
footer: 'Your Name · Group Seminar'
---

> [!aigc]
>
> # 标题同样属于生成内容
>
> ## 一个核心观点
>
> - 生成的正文、代码、公式、表格、图注都在框内。
```

- 所有 AI 新增/实质性改写的内容必须使用 `> [!aigc]`，由 engine 渲染为 `.callout.aigc`。纯生成页面可用一个框包住标题与正文，避免重复标签。
- 混合来源只标记生成部分，不把人工原文重新标成 AI。保留人类作者的论述、引用与链接；生成备注以 `AIGC:` 标识。
- 每行（包括空行、代码围栏）都加 `>`；分页 `---` 和控制 directive 放在框外。
- 不使用原始 HTML `<span>` 包裹生成内容，raw HTML 已禁用。紫色虚线框、标签与 logo 表示来源，不表示事实已经核验。
- 将 `make-marp-slides` 输出的页面片段插入现有报告时，保留报告自己的 frontmatter；skill 默认不生成 frontmatter、封面或结束页。

### 分页、fragments 与按键

`---` 创建新页；`*` 或 `1)` 列表是 Marp 原生同页 fragments，不额外计页；普通 `-` 列表一次显示。`--` 不是分页符，不支持二维纵向子页。

`j/l` 下一步、`h/k` 上一步、`gg` 第一页、`G` 最后一页，沿用原生片段/线性导航。编辑区域、组合输入、修饰键和终端输入不会被这些翻页别名接管。全屏与终端用法见[终端预览](../docs/terminal.md)。

### Callout

```markdown
> [!note] 自定义标题
> 正文支持 **强调**、列表、公式、代码和嵌套 callout。
>
> > [!warning] 限制
> > 注意适用范围。
```

支持 note / abstract / info / todo / tip / success / question / warning / failure / danger / bug / example / quote 及常见别名，未知类型用默认样式。`[!type]+` / `[!type]-` 始终展开，便于幻灯片与 PDF 一致；这不是完整 Obsidian 方言，不提供 wikilink、embed 或折叠 UI。

### 图文分栏

```markdown
<!-- _class: image-split -->

> [!aigc]
>
> # 图片与论点
>
> 左栏解释，保持简短。
>
> ![图注](assets/workflow.svg)
```

标题跨两栏，文字左、图片右；图片保持比例并受边界限制。不要给图片再设置巨大的固定宽度。一般每页最多一张主图；AI 未获授权时不生成图片或图表。

## 字体与页脚

默认 Linux Biolinum 正文、PingFang SC / Noto Sans CJK SC 中文回退、MD IO 代码。`math: katex` 配合共享 engine 输出原生 MathML，使用 Cambria Math；`math: mathjax` 改用 MathJax 的 SVG 字体。字体不分发，修改方法见[字体指南](../docs/customization.md)。

底部蓝带左侧为 `footer`，右侧为当前页/总页数，没有顶部色带。封面可用 `<!-- _paginate: false -->` 隐藏页码，但仍计入总页数。

已有报告不会自动更新：按需合并 `theme.css` 与素材，不覆盖 `slides.md`。模板维护/验证规则见 [AGENT.md](AGENT.md)。

## 素材版权

`assets/aigc-badge.png` 来自用户指定的[高达官方图片](https://gundam-official.com/media/UC_0b76f920b8/UC_0b76f920b8.png)，保留第三方权利，**不适用仓库 MIT 许可证**。对外分发前确认使用权限，或替换为有权使用的标识。标识不代表官方背书。

## 官方语法参考

[Marpit Theme CSS](https://marpit.marp.app/theme-css) · [Directives](https://marpit.marp.app/directives) · [Fragments](https://marpit.marp.app/fragmented-list) · [Obsidian Callouts](https://help.obsidian.md/callouts) · [Marp functional engine](https://github.com/marp-team/marp-cli#functional-engine)
