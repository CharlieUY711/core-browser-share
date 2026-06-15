const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage, session } = require("electron");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const WEB_URL = process.env.WEB_URL || "https://compartir.core.com.uy";

let mainWindow = null;
let tray = null;
let agentStop = null;

// ── Ventana principal ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0f0f17",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Permitir que el renderer capture pantalla via getDisplayMedia
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ["screen", "window"] }).then((sources) => {
      callback({ video: sources[0], audio: "loopback" });
    });
  });

  mainWindow.loadURL(WEB_URL);
}

// ── IPC: listar fuentes de pantalla ──────────────────────────────────────────
ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

// ── IPC: iniciar agente de control ────────────────────────────────────────────
ipcMain.handle("agent:start", async (_e, sessionCode) => {
  if (agentStop) return { ok: true };
  try {
    agentStop = await startControlAgent(sessionCode);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("agent:stop", async () => {
  if (agentStop) { agentStop(); agentStop = null; }
  return { ok: true };
});

// ── Agente de control remoto ──────────────────────────────────────────────────
async function startControlAgent(sessionCode) {
  const { mouse, keyboard, Point, Key, Button, screen } = require("@nut-tree-fork/nut-js");
  mouse.config.mouseSpeed = 2000;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const screenW = await screen.width();
  const screenH = await screen.height();

  const KEY_MAP = {
    Enter: Key.Return, Backspace: Key.Backspace, Delete: Key.Delete,
    Escape: Key.Escape, Tab: Key.Tab, ArrowUp: Key.Up, ArrowDown: Key.Down,
    ArrowLeft: Key.Left, ArrowRight: Key.Right, " ": Key.Space,
    F1: Key.F1, F2: Key.F2, F3: Key.F3, F4: Key.F4,
    F5: Key.F5, F6: Key.F6, F7: Key.F7, F8: Key.F8,
  };

  async function handleControl(event) {
    try {
      const px = Math.round((event.x ?? 0) * screenW);
      const py = Math.round((event.y ?? 0) * screenH);
      switch (event.type) {
        case "mousemove":
          await mouse.move([new Point(px, py)]); break;
        case "mousedown": {
          const btn = event.button === "right" ? Button.RIGHT : event.button === "middle" ? Button.MIDDLE : Button.LEFT;
          await mouse.move([new Point(px, py)]);
          await mouse.pressButton(btn); break;
        }
        case "mouseup": {
          const btn = event.button === "right" ? Button.RIGHT : event.button === "middle" ? Button.MIDDLE : Button.LEFT;
          await mouse.move([new Point(px, py)]);
          await mouse.releaseButton(btn); break;
        }
        case "scroll":
          if ((event.delta ?? 0) > 0) await mouse.scrollDown(Math.round(Math.abs(event.delta) / 100));
          else await mouse.scrollUp(Math.round(Math.abs(event.delta) / 100));
          break;
        case "keydown": {
          const k = KEY_MAP[event.key];
          if (k) await keyboard.pressKey(k);
          else if (event.key?.length === 1) await keyboard.type(event.key);
          break;
        }
        case "keyup": {
          const k = KEY_MAP[event.key];
          if (k) await keyboard.releaseKey(k);
          break;
        }
      }
    } catch {}
  }

  const ch = supabase.channel(`control:${sessionCode}`, {
    config: { presence: { key: "agent" } }
  });

  ch.on("broadcast", { event: "control" }, ({ payload }) => handleControl(payload))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ online_at: new Date().toISOString(), screenW, screenH });
        mainWindow?.webContents.send("agent:ready", { screenW, screenH });
      }
    });

  return () => {
    supabase.removeChannel(ch);
    mainWindow?.webContents.send("agent:stopped");
  };
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../assets/icon.png")).resize({ width: 16 });
    tray = new Tray(icon);
    tray.setToolTip("Core — Compartir pantalla");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Abrir Core", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: "Salir", click: () => app.quit() },
    ]));
    tray.on("double-click", () => mainWindow?.show());
  } catch {}
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (agentStop) agentStop();
});
