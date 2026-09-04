# virgiling-slides

`virgiling-slides` 是一个面向学术报告的 Beamer 文档类，提供紧凑的顶部进度导航、三栏页脚、统一的页面留白，以及适合公式和代码展示的字体配置。

## 功能

- 16:9 默认示例，并兼容标准 Beamer 类选项；
- section 名称和 frame 进度圆点组成的顶部导航；
- 不显示 subsection 标题的独立强调色带；
- 标题页、总目录和分节目录命令；
- 方形无序列表和带数字的方形有序列表；
- block、columns、overlay、handout、speaker notes 和 appendix；
- Cambria Math 数学字体；
- MD IO 行内代码与 verbatim 字体；
- 可覆盖的三栏页脚内容。

## 环境要求

- Tectonic
- Cambria Math
- MD IO：Regular、Bold、Italic、Bold Italic
- Skim，用于 Zed 编译后的 PDF 定位与刷新

Linux Biolinum 正文字体由 Tectonic 的 TeX 资源包提供。Cambria Math 和 MD IO 直接从系统字体库加载，不需要复制字体或运行初始化脚本。

Tectonic 读取系统字体时可能输出：

```text
accessing absolute path ... build may not be reproducible
```

这表示构建依赖本机字体，不是字体缺失错误。

## 文件结构

```text
template/
├── .zed/tasks.json       # Zed 编译任务
├── AGENT.md              # 模板维护约束
├── README.md             # 使用说明
├── example.tex           # 完整功能示例
├── virgiling-slides.cls  # Beamer 文档类
└── build/                # 编译产物，不纳入版本控制
```

## Zed

用 Zed 打开模板目录，执行 `LaTeX: Tectonic + Skim` 任务。任务会：

1. 创建 `build/`；
2. 编译当前 `.tex` 文件；
3. 把 PDF、SyncTeX、日志和辅助文件写入 `build/`；
4. 使用 Skim 打开或刷新对应 PDF，并跳转到当前源码行。

任务等价于：

```bash
mkdir -p build
tectonic -X compile example.tex \
  --outdir build \
  --keep-logs \
  --keep-intermediates \
  --synctex
```

生成的示例位于 `build/example.pdf`。

## 基本用法

```latex
\documentclass[10pt,aspectratio=169]{virgiling-slides}

\title[Short Title]{Full Presentation Title}
\subtitle{Optional Subtitle}
\author[Your Name]{Your Name}
\institute[Institution]{Department or Research Group\\Institution}
\date[Event 2026]{Event or Seminar Name\\Month 2026}

\begin{document}

\VirgilingTitleFrame
\VirgilingOutlineFrame

\section{Introduction}
\subsection{Motivation}

\begin{frame}{Motivation}
  Your content.
\end{frame}

\end{document}
```

经典 4:3 比例：

```latex
\documentclass[10pt]{virgiling-slides}
```

打印版：

```latex
\documentclass[10pt,aspectratio=169,handout]{virgiling-slides}
```

## 模板命令

### 标题页

```latex
\VirgilingTitleFrame
```

标题页保留顶部色带和页脚，但不显示 section 名称或进度圆点。

### 总目录

```latex
\VirgilingOutlineFrame
\VirgilingOutlineFrame[Presentation Overview]
```

### 分节目录

在导言区启用：

```latex
\VirgilingEnableSectionOutlines
\VirgilingEnableSectionOutlines[Section Overview]
```

启用后，每个 section 开始时会自动插入当前分节目录。

### 页脚

方括号中的短元数据会自动用于页脚：

```latex
\title[Short Title]{Full Presentation Title}
\author[Your Name]{Your Name}
\institute[Institution]{Full Institution Name}
\date[Event 2026]{Event or Seminar Name\\Month 2026}
```

也可以分别覆盖：

```latex
\renewcommand{\VirgilingFooterLeft}{Your Name (Institution)}
\renewcommand{\VirgilingFooterCenter}{Short Presentation Title}
\renewcommand{\VirgilingFooterRight}{Event 2026\hfill\insertframenumber/\inserttotalframenumber}
```

## 示例内容

`example.tex` 是可直接编译的功能索引，包含列表、分栏、三种 block、数学公式、定义、定理、证明、表格、TikZ 图、外部图片写法、代码、overlay、脚注、引用、内部跳转、结束页和备用页。
