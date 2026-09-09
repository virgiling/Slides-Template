---
marp: true
theme: virgiling
size: 16:9
paginate: true
math: katex
title: Markdown-first slides
author: Your Name
footer: 'Your Name · Group Seminar'
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Markdown-first slides

组内分享 · 快速讨论 · 学习笔记

Your Name / Research Group

<!-- Speaker notes are Markdown comments. Do not put secrets here: comments can enter presenter notes. -->

---

# One slide, one message

- 用 Markdown 写内容，用 `---` 分页。
- 用 `<!-- _class: lead -->` 设置当前页版式。
- **强调结论**，把补充说明放进演讲备注。

> 这套模板用于轻量分享；正式报告使用旁边的 LaTeX 模板。

---

# Code is content

```python
def summarize(values):
    if not values:
        raise ValueError("empty input")
    return sum(values) / len(values)
```

代码采用 MD IO（若未安装则回退到系统等宽字体）。

---

# Mathematics

用 `$...$` 写行内公式：$x_{k+1} = T(x_k)$。

$$
\hat{\theta} = \arg\min_\theta
\sum_{i=1}^{n} \left(y_i - f_\theta(x_i)\right)^2
$$

KaTeX 负责公式渲染，不依赖 LaTeX 编译器。

---

# Choose the right track

| | LaTeX | Marp |
| --- | --- | --- |
| 场合 | 答辩 / 正式报告 | 学习分享 / 讨论 |
| 输入 | `main.tex` | `slides.md` |
| 默认输出 | PDF | HTML |
| 构建工具 | Tectonic | Marp CLI |

两套模板各自原生写作，不强求同一份源文件。

---

![bg right:40% contain](assets/workflow.svg)

# Native image layout

使用 Marp 的背景图片语法即可分栏：

`![bg right:40% contain](assets/workflow.svg)`

图片使用相对路径，和报告一起保存。

---

<!-- _class: lead -->

# Questions?

改 Markdown → 编译 HTML → 人工打开演示

[Marp 文档](https://marp.app/) · [Marp CLI](https://github.com/marp-team/marp-cli)
