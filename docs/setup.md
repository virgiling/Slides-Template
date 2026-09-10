# 安装与日常操作

[← 模板首页](../README.md) · [字体与样式](customization.md) · [终端预览](terminal.md)

## 需要什么

| 用途 | 依赖 |
| --- | --- |
| 克隆、初始化工作区、管理命令 | Git、Python 3.10+、Make、POSIX shell（macOS/Linux） |
| Marp HTML 与实时预览 | Node.js 18+、Bun；`make install` 安装锁定的 Marp CLI 4.5.1 / Core 4.4.0 |
| LaTeX PDF | Tectonic；模板指定的系统字体 |
| Marp PDF / PNG | Marp 支持的本地浏览器编译引擎，如 Chrome/Chromium；只生成 HTML 不需要它 |
| 网页终端（可选） | ttyd（需 Unix socket 支持）、Zellij、fish |
| 终端 Nerd Font 图标（可选） | Symbols Nerd Font Mono，例如 `eza --icons` 所用图标 |
| 重建封面、PDF 布局测试（可选） | Poppler |
| 编辑 / 人工预览（可选） | Zed；macOS 的 Skim 用于 LaTeX SyncTeX |

正文、数学、代码默认字体及替换方法见[字体指南](customization.md)。字体不随仓库分发，MD IO / Cambria Math 等需自行合法获取；Marp 缺字时会回退，LaTeX 指定字体缺失时通常直接报错。

macOS 已有 Homebrew 时，可按所需功能**自行选择**安装：

```bash
brew install node python tectonic           # LaTeX 不需要 Node；Marp 不需要 Tectonic
brew install ttyd zellij fish               # 可选网页终端
brew install poppler                       # 可选 PDF 检查 / 封面工具
```

Bun 按[官方安装说明](https://bun.sh/docs/installation)安装。Windows 使用具备这些依赖的 WSL 环境；原生 Windows 工作流未验证。初始化脚本不会安装软件、下载字体、修改 shell/Ghostty/Agent 全局配置或启动服务。

## 只克隆这个仓库也能完整运行

仓库必须放在一个专用工作区的 `template/` 下：

```bash
mkdir slides
cd slides
git clone https://github.com/virgiling/Slides-Template.git template
python3 template/.agents/skills/init-slides-os/scripts/init_workspace.py --check
python3 template/.agents/skills/init-slides-os/scripts/init_workspace.py
make install
make doctor TYPE=marp
make build-template TYPE=marp
```

示例产物：`template/marp/build/example.html`，图片在同级 `assets/`。这条路径包含 callout、AIGC 框、原生 MathML 和翻页增强，不是仅套用 CSS 的降级预览。

如果已经克隆为 `Slides-Template/` 等名称，先将该克隆安排到一个专用父目录的 `template/` 中，再运行脚本。脚本不自动移动仓库，不支持以符号链接代替 `template/`。AI 调整现有目录位置前应征得同意。

初始化资源随仓库保存在 `.agents/skills/init-slides-os/assets/`；脚本通过显式清单及 SHA-256 校验，将共享工具写到父工作区。已有相同文件跳过，任何不同文件、符号链接或不合法路径都会在写入前报错，**没有强制覆盖选项**。不要在包含无关项目的目录中初始化；碰到冲突请使用新的专用目录，或人工比较后逐个合并。

```text
slides/                         # 运行时工作区；依赖只装一次
├── Makefile / package.json / bun.lock
├── scripts/ / tests/ / .zed/
├── .agents/skills/              # 仅 make-marp-slides 写作入口
├── template/                   # 本次克隆，保持独立 Git 仓库
│   ├── docs/ / .agents/skills/
│   ├── marp/                   # 只有主题、示例、素材、文档
│   └── latex/                  # 只有文档类、示例、素材、文档
└── <talk>/                     # 新报告，工具不复制进去
```

初始化不创建 Git 提交、不改 remote。若要管理父工作区版本，可自行在父目录建立仓库；其 `.gitignore` 已忽略独立的 `template/`。

> 新版 README、skill 和初始化资源需要存在于你克隆的版本中；本地尚未提交/推送的改动不会自动出现在远端。本工具不自动发布。

## 创建、编辑、预览、导出

以下命令全部在 `slides/`（不是 `template/`）执行：

```bash
make new NAME=group-sharing TYPE=marp
# 编辑 group-sharing/slides.md；样式在 group-sharing/theme.css
make serve SLIDE=group-sharing              # 人工打开输出的 Preview: URL
make build SLIDE=group-sharing              # build/slides.html + build/assets/
make build SLIDE=group-sharing FORMAT=pdf   # build/slides.pdf

make new NAME=conference-talk TYPE=latex   # 不写 TYPE 时也默认 LaTeX
# 编辑 conference-talk/main.tex
make build SLIDE=conference-talk           # build/main.pdf
```

- `make serve` 不指定 SLIDE 时预览 Marp 模板示例；`SLIDE` 是报告目录名，不是 Markdown 文件名。
- 在报告子目录可用 `make -C .. serve SLIDE=group-sharing`。
- Markdown、CSS、公开图片修改会热更新；共享脚本/字体参数修改后需 Ctrl-C 重启 `make serve` 并刷新页面。
- `make watch SLIDE=...` 仅重建磁盘 HTML，不提供 URL，也不持续同步新增图片；日常使用推荐 `serve`。
- `make preview SLIDE=...` 会构建并打开系统查看器，仅供人工主动使用。`make serve` 不自动打开浏览器。
- 分享 Marp HTML 时复制整个 `build/`，不要只分享一个 HTML 或另存本地预览网页。
- 报告名使用英文字母、数字、点、下划线和连字符，不以点/连字符开头。`template`、`scripts`、`tests` 为保留名称。

其他命令：

```bash
make help
make list
make clean SLIDE=group-sharing              # 仅清理该报告 build/
make build-all                             # 不含模板
make clean-all
make delete SLIDE=group-sharing CONFIRM=group-sharing  # 永久删除，谨慎使用
make thumbnails TYPE=marp                  # 或 latex；重建真实封面
```

## Zed 与 AI

用 Zed 打开外层 `slides/`，使用 `Slides: Build Current`、`Slides: Serve Current (Marp)` 等任务。路由由当前文件所属报告决定；正式报告也可单独使用 [LaTeX 的 Zed 任务](../latex/README.md#zed)。

- [init-slides-os](../.agents/skills/init-slides-os/SKILL.md)：按所需格式检查依赖并初始化工作区。
- [make-marp-slides](../.agents/skills/make-marp-slides/SKILL.md)：仅把指定讲义片段转成 Marp 页面片段，不生成整份讲义。

使用 `.agents/skills/<name>/SKILL.md` 标准结构，不是 `.agents/skill/name.md`。初始化只在外层放置 `make-marp-slides` 轻量入口；`init-slides-os` 留在模板仓库，完整规则仍只有模板中的一份。重新加载项目技能后，pi 在外层可调用 `/skill:make-marp-slides`；在模板目录中才加载 `/skill:init-slides-os`，也可直接读取模板中的初始化 skill。不支持自动发现的 Agent 可直接读取上述文件。其他 harness 的发现路径/调用命令以其文档为准，不修改个人配置。

旧版工作区如果已有 `.agents/skills/init-slides-os/SKILL.md`，确认它只是生成的转发入口后可删除；新版不会再生成它，也不会擅自删除用户已有技能。

## 更新与验证

新报告是源码副本，不自动跟随模板升级。更新旧报告时保留个人修改，只按需合并 `theme.css`、文档类及素材，**不要覆盖讲稿**。

共享工具的维护源在外层 `scripts/`、`tests/` 等路径。修改后执行以下命令，把公开源码同步到初始化资源；不要手工修改资源副本：

```bash
python3 scripts/package-bootstrap.py
python3 scripts/package-bootstrap.py --check
make test
bun run check
TTYD_TEST=1 bun run check                  # 可选：真实 ttyd/Zellij/fish，隔离合成会话
SLIDES_TEST_BOOTSTRAP=1 make test           # 可选：全新初始化后实际安装依赖并编译 Marp
MARP_TEST_PDF=1 make test                   # 可选：PDF 几何/字体相关布局检查
```

模板只克隆到本地时，资源包就是可复现外层工具的分发来源。模板升级后重新初始化：相同文件跳过，变更文件报冲突；在新的专用工作区初始化并比较是最安全的更新方式。测试不使用浏览器工具或视觉模型；PDF/PNG 可通过独立编译引擎生成，外观由人确认。
