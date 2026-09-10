---
name: init-slides-os
description: Initialize a usable LaTeX/Marp slides workspace from a standalone Slides-Template clone. Use for a fresh clone, a new machine, missing shared Marp tooling, or slides environment setup.
---

# Initialize Slides Workspace

将模板克隆初始化成可运行的工作区，不是安装新操作系统，也不生成讲稿内容。

先完整阅读[模板规则](../../../AGENT.md)与[安装指南](../../../docs/setup.md)；字体问题再读[字体指南](../../../docs/customization.md)。相对路径均以本 SKILL.md 所在目录为基准，不以当前工作目录为基准。

## 1. 确认目标与权限

- 区分只用 LaTeX、只用 Marp，或同时使用两种；网页终端是可选项，不把 ttyd/Zellij/fish 变成普通 HTML 构建的必装依赖。
- 检查目标是否是一个专用工作区，模板克隆位于 `<workspace>/template/`。若路径不同，提出明确的目录安排；移动现有仓库或使用包含无关项目的父目录前询问用户。
- 保留已有报告、Git 状态、字体与全局配置。禁止读取/复制用户会话、凭据、`.env`、`.claude/`、`.pi/` 或私有日志。
- Skill 不授予安装、覆盖、提交、推送、启动 Agent 或生成图像的额外权限。软件安装/网络下载须在用户授权范围内；仅请求“检查环境”时不要安装。

## 2. 检查依赖

按安装指南，仅通过命令存在性、版本和必要的字体名称/覆盖信息检查相关依赖。不打开或枚举用户会话。

- 初始化需要 Python 3.10+；Make 命令需要 POSIX shell。
- Marp 需要 Node.js 18+、Bun；共享 JS 依赖通过锁定的 `make install` 安装。
- LaTeX 需要 Tectonic 和模板指定的系统字体，不需要 Node/Bun。
- 网页终端按需需要 ttyd（Unix socket）、Zellij、fish；图标回退使用本机 Symbols Nerd Font Mono。
- PDF/PNG 编译引擎、Poppler、Skim/Zed 都按所需功能判断，不无条件安装整套。
- 未获安装授权时，列出缺少项与操作命令；不要擅自修改 Homebrew、shell、Ghostty 或 Agent 全局设置。

## 3. 初始化

阅读并运行本 skill 附带的 [scripts/init_workspace.py](scripts/init_workspace.py)：

```bash
python3 <absolute-skill-directory>/scripts/init_workspace.py --check
python3 <absolute-skill-directory>/scripts/init_workspace.py
```

脚本从清单复制随仓库分发的公开初始化资源到父工作区，并仅生成外层 `make-marp-slides` 技能入口；`init-slides-os` 本身留在模板仓库。它不下载、不安装、不移动仓库、不启动服务、不创建 Git 提交。已存在且相同的文件跳过；不同内容或符号链接直接报冲突，先解决冲突再继续，**不要绕过检查强制覆盖**。

运行后仍在外层安装依赖、构建和管理报告，不能在 `marp/` 或单份讲稿中安装 node_modules。若只要独立 LaTeX 编译，可按指南跳过整个共享工作区初始化。

## 4. 验证所选功能

获授权的 Marp 初始化，在外层工作区执行：

```bash
make install
make doctor TYPE=marp
make build-template TYPE=marp
```

确认 `template/marp/build/example.html` 与素材存在；完整示例必须通过共享 engine，不用 vanilla CLI 掩盖 callout 缺失。

LaTeX 选择 `make doctor TYPE=latex` / `make build-template TYPE=latex`，或指南中的原生命令；只检查本次编译的日志、PDF 文本与字体。

不为验证自动运行用户的 `make serve`、打开浏览器/查看器或启动 Agent。用户明确要预览时再启动并交付 `Preview:` URL；要验证服务可使用项目现有的隔离 HTTP/WebSocket 测试。原生 PDF/PNG 编译允许独立浏览器引擎，但不使用浏览器工具或视觉模型检查外观。

## 5. 简短交接

报告初始化到哪里、实际验证了哪些功能、还缺哪些依赖，以及接下来一条创建/预览命令。缺字体与缺字不等于 ttyd 不支持 Unicode。不能把跳过的构建、图标外观或多端体验说成已验证。默认不提交、不推送；后续制作片段使用 [make-marp-slides](../make-marp-slides/SKILL.md)。
