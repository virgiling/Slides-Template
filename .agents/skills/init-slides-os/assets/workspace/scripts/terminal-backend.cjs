// ttyd is lazy and preview-owned. Zellij is only a persistent native session, not a Web service.
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Neutral off-white RGB reports a light background (OSC 11) and matches the preview glass.
// Alpha 00 leaves the canvas transparent; dark, warm glyphs remain opaque.
const terminalTheme = {
  background: "#e8e8e800",
  foreground: "#3f3326",
  cursor: "#3f3326",
  cursorAccent: "#f7f0e4",
  selectionBackground: "#9b734333",
  selectionInactiveBackground: "#79695126",
  black: "#3f3326",
  red: "#7b3028",
  green: "#2e5131",
  yellow: "#634719",
  blue: "#2b4b69",
  magenta: "#5d365f",
  cyan: "#225558",
  white: "#4e463b",
  brightBlack: "#53493b",
  brightRed: "#853027",
  brightGreen: "#315638",
  brightYellow: "#664b1c",
  brightBlue: "#334d6e",
  brightMagenta: "#653a67",
  brightCyan: "#235859",
  brightWhite: "#594f41",
};

function sessionName(cwd, selected = "") {
  const name =
    selected.trim() ||
    `slides-${createHash("sha256").update(cwd).digest("hex").slice(0, 10)}`;
  if (
    name.startsWith("-") ||
    name === "." ||
    name === ".." ||
    /[\x00-\x1f\x7f/\\]/.test(name)
  ) {
    throw new Error("Invalid terminal session name");
  }
  return name;
}

function createTerminalBackend({ cwd, session = "", env = process.env }) {
  const automaticSession = !session.trim();
  session = sessionName(cwd, session);
  let child,
    temporary,
    pending,
    closed = false;
  const alive = () => child && child.exitCode === null && child.signalCode === null;
  async function launch() {
    for (const name of ["ttyd", "zellij", "fish"]) {
      const available = String(env.PATH || "")
        .split(path.delimiter)
        .some((directory) => {
          try {
            fs.accessSync(path.join(directory, name), fs.constants.X_OK);
            return true;
          } catch {
            return false;
          }
        });
      if (!available) throw new Error(`Missing terminal tool: ${name}`);
    }
    // Short, private socket path works within macOS's sockaddr_un limit too.
    temporary = fs.mkdtempSync("/tmp/slides-ttyd-");
    fs.chmodSync(temporary, 0o700);
    const socketPath = path.join(temporary, "terminal.sock");
    const childEnv = { ...env };
    for (const key of ["ZELLIJ", "ZELLIJ_SESSION_NAME", "ZELLIJ_PANE_ID"])
      delete childEnv[key];
    const args = [
      "--interface",
      socketPath,
      "--writable",
      "--check-origin",
      "--auth-header",
      "x-slides-user",
      "--cwd",
      cwd,
      "--debug",
      "1",
      "-t",
      "disableLeaveAlert=true",
      "-t",
      "disableResizeOverlay=true",
      "-t",
      "titleFixed=Slides terminal",
      "-t",
      // MD IO stays primary; Nerd Font supplies eza/CLI icons in Unicode private-use areas.
      "fontFamily=MD IO, Symbols Nerd Font Mono, Menlo, monospace",
      "-t",
      "fontSize=14",
      "-t",
      "allowTransparency=true",
      "-t",
      "minimumContrastRatio=4.5",
      "-t",
      `theme=${JSON.stringify(terminalTheme)}`,
      "zellij",
      "--layout",
      path.join(__dirname, "terminal-layout.kdl"),
      "attach",
      "--create",
      session,
      "options",
      "--default-shell",
      "fish",
      "--default-cwd",
      cwd,
      "--on-force-close",
      "detach",
      "--web-server",
      "false",
      ...(automaticSession ? ["--session-serialization", "false"] : []),
      "--show-startup-tips",
      "false",
      "--show-release-notes",
      "false",
    ];
    child = spawn("ttyd", args, { cwd, env: childEnv, detached: true, stdio: "ignore" });
    let failed = false;
    child.on("error", () => {
      failed = true;
    });
    for (let n = 0; n < 100; n++) {
      if (closed || failed || !alive()) break;
      if (fs.existsSync(socketPath)) {
        fs.chmodSync(socketPath, 0o600);
        const ready = await new Promise((resolve) => {
          const socket = net.connect(socketPath);
          socket.setTimeout(200);
          socket.on("connect", () => {
            socket.destroy();
            resolve(true);
          });
          socket.on("error", () => resolve(false));
          socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
          });
        });
        if (ready) return socketPath;
      }
      await delay(50);
    }
    throw new Error("ttyd could not start");
  }
  return {
    session,
    start() {
      if (closed) return Promise.reject(new Error("Terminal preview is closed"));
      if (!pending) pending = launch();
      return pending;
    },
    async close() {
      closed = true;
      await pending?.catch(() => {});
      if (alive()) {
        child.kill("SIGTERM"); // ttyd closes only its PTYs; Zellij detaches and keeps shells alive.
        for (let n = 0; n < 60 && alive(); n++) await delay(50);
        if (alive()) {
          const exited = new Promise((resolve) => child.once("exit", resolve));
          child.kill("SIGKILL");
          await exited;
        }
      }
      if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
    },
  };
}
module.exports = { createTerminalBackend, sessionName };
