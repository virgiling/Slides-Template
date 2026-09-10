# 本地终端预览

[← 模板首页](../README.md) · [安装与操作](setup.md) · [字体与样式](customization.md)

## 打开、全屏、关闭

在初始化后的外层工作区：

```bash
make serve                            # 预览 Marp 示例
make serve SLIDE=group-sharing        # 预览一份报告
make serve SLIDE=group-sharing PORT=8081
```

人工打开输出的 **`Preview:` URL**，点击右上角「打开终端」。需要 ttyd、Zellij 和 fish；缺少这些工具只影响可选终端，不影响幻灯片。

- 首次打开可创建一个普通 fish shell，不会自动运行 pi、Codex、Claude 等 Agent，也不会自动发送幻灯片内容。需要什么命令由你自己运行。
- 全高圆角抽屉覆盖但不挤压幻灯片；展开后隐藏打开按钮，只保留左侧 `>` 收起按钮。
- 幻灯片获得焦点时，原生全屏按钮或 `f` / `F11` 使**整个预览页面**全屏，终端入口仍可用。再次操作或按浏览器的 Escape 退出。
- 终端获得焦点后，键盘交给终端，不会同时触发幻灯片翻页/全屏快捷键。
- 翻页、全屏和 Markdown 热更新不重连终端。收起后再打开可重新连接。
- Ctrl-C 停止预览，只关闭它管理的服务/客户端；Zellij 中的 shell 和 Agent 继续运行。

不需要 `zellij web`、Web 分享开关或手动登录令牌。底层是 ttyd 原生网页终端，Zellij 只负责原生会话保活。

## 在 Ghostty 中使用同一会话

```fish
make serve TERMINAL_SESSION=slides
# 在 Ghostty 的另一个未运行 Zellij 的标签页：
zellij attach slides
```

不指定名称时，会话名根据初始工作目录稳定生成；重启预览仍可连接它。主题示例进入外层工作区，报告预览进入报告目录；已有会话保留当前 cwd。

同一会话内共享的是正在运行的进程，不是复制历史。**普通 Ghostty 终端中未运行在 Zellij 内的既有进程不能被接管。** 关闭预览不等于退出 shell；需要结束会话时由用户主动退出其中的程序/shell。整机重启后的历史恢复不属于实时保活。

## 常见问题

| 现象 | 操作 |
| --- | --- |
| `shared Marp tooling missing` | 在外层工作区运行 `make install`；若连 Makefile/engine 都没有，先按[初始化步骤](setup.md)生成工作区 |
| 打开终端提示缺少工具 | 安装 ttyd/Zellij/fish 后重启预览；ttyd 需支持 Unix socket |
| 字体/颜色改了没生效 | 共享脚本参数需重启 `make serve`，再刷新页面；不要删除会话 |
| `eza --icons` 显示方框 | 确认 Symbols Nerd Font Mono 已安装，且列在网页终端 fontFamily 回退列表；详见[字体指南](customization.md#网页终端) |
| 全屏后看不到打开按钮 | 使用 `Preview:` URL，不是内部 Marp 地址或导出的 HTML；更新共享预览脚本后重启服务 |
| 端口被占用 | 停止自己旧的预览，或使用 `PORT=8081`；不要杀掉不认识的进程 |
| `ZELLIJ_PORT is obsolete` | 删除旧参数；服务由预览自动管理 |
| 共享到了不同会话 | 两端显式使用相同的 `TERMINAL_SESSION` / `zellij attach` 名称 |
| 连接失败或 Cookie 问题 | 使用打印的同一个 URL，不混用 `localhost` 与 `127.0.0.1`；收起再打开，必要时刷新 |

`ZELLIJ_SESSION` 仍是会话名的兼容别名，`TERMINAL_SESSION` 优先。页面没有宽度滑块、外部窗口、会话信息行或独立重连工具栏。

## 使用边界

这是**本人本机使用**的终端，不是远程服务、多用户隔离环境或命令沙箱。终端拥有本人普通 shell 的权限。

- TCP 仅监听 loopback，ttyd 使用私有 Unix socket；预览通过一次性引导能力、HttpOnly Cookie 和 Host/Origin 检查自动授权。
- 原生本机进程视为可信；不要公开转发/反向代理端口，不要把包含连接信息的预览页面分享出去。
- 只向 HTTP 服务复制选中报告的公开 Markdown、theme 和素材，不挂载整个私有目录。演讲备注也属于可能公开的报告内容。
- 导出 HTML/PDF/PNG 不含终端、连接信息或预览 UI；正式分享使用 `make build` 的输出。
- 不读取用户历史、凭据、Agent 配置或会话文件；不自动停止用户会话。无需改 Ghostty、fish 或 Agent 的全局配置。

功能通过 CLI/HTTP/WebSocket 检查；字体实际显示、输入法、剪贴板和浏览器全屏体验由人确认。没有浏览器视觉验证或性能优越性承诺。
