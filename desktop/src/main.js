const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEB_URL = process.env.WEB_URL || "https://compartir.core.com.uy";

let mainWindow = null;
let tray = null;
let agentRunning = false;
let agentStop = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f0f17",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
  });

  mainWindow.loadURL(WEB_URL);

  // Cuando la web pide iniciar el agente
  ipcMain.handle("agent:start", async (_e, sessionCode) => {
    if (agentRunning) return { ok: true };
    try {
      agentStop = await startAgent(sessionCode);
      agentRunning = true;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle("agent:stop", async () => {
    if (agentStop) { agentStop(); agentStop = null; }
    agentRunning = false;
    return { ok: true };
  });

  ipcMain.handle("agent:status", () => ({ running: agentRunning }));
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "../assets/icon.png")).resize({ width: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Core — Compartir pantalla");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Core", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "Salir", click: () => app.quit() },
  ]));
  tray.on("double-click", () => mainWindow?.show());
}

// ── Agent (WebRTC + control) ──────────────────────────────────────────────────
async function startAgent(sessionCode) {
  const wrtc = require("@roamhq/wrtc");
  const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, nonstandard } = wrtc;
  const { RTCVideoSource } = nonstandard;
  const { mouse, keyboard, Point, Key, Button, screen } = require("@nut-tree-fork/nut-js");
  const screenshot = require("screenshot-desktop");
  const { Jimp } = require("jimp");

  mouse.config.mouseSpeed = 2000;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const screenWidth = await screen.width();
  const screenHeight = await screen.height();
  const W = 1280;
  const H = Math.round(1280 * screenHeight / screenWidth);

  const KEY_MAP = {
    Enter: Key.Return, Backspace: Key.Backspace, Delete: Key.Delete,
    Escape: Key.Escape, Tab: Key.Tab, ArrowUp: Key.Up, ArrowDown: Key.Down,
    ArrowLeft: Key.Left, ArrowRight: Key.Right, " ": Key.Space,
  };

  let pc = null;
  let captureRunning = false;

  // Screen capture loop
  async function startCapture(videoSource) {
    captureRunning = true;
    const FPS = 15;
    const capture = async () => {
      if (!captureRunning) return;
      const start = Date.now();
      try {
        const buf = await screenshot({ format: "png" });
        const img = await Jimp.read(buf);
        img.resize({ w: W, h: H });
        const data = new Uint8ClampedArray(W * H * 4);
        let i = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            data[i++] = img.bitmap.data[idx];
            data[i++] = img.bitmap.data[idx + 1];
            data[i++] = img.bitmap.data[idx + 2];
            data[i++] = 255;
          }
        }
        videoSource.onFrame({ width: W, height: H, data });
      } catch {}
      const elapsed = Date.now() - start;
      setTimeout(capture, Math.max(0, 1000 / FPS - elapsed));
    };
    capture();
  }

  // Control events
  async function handleControl(event) {
    try {
      const px = Math.round((event.x ?? 0) * screenWidth);
      const py = Math.round((event.y ?? 0) * screenHeight);
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
          if ((event.delta ?? 0) > 0) await mouse.scrollDown(Math.round(event.delta / 100));
          else await mouse.scrollUp(Math.round(Math.abs(event.delta ?? 0) / 100));
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

  // Signaling
  const signalingCh = supabase.channel(`signaling:${sessionCode}`);
  const controlCh = supabase.channel(`control:${sessionCode}`);

  signalingCh
    .on("broadcast", { event: "signal" }, async ({ payload }) => {
      if (payload.from === "agent") return;

      if (payload.type === "ready") {
        pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        const videoSource = new RTCVideoSource();
        pc.addTrack(videoSource.createTrack());
        startCapture(videoSource);

        pc.onicecandidate = async ({ candidate }) => {
          if (candidate) await signalingCh.send({
            type: "broadcast", event: "signal",
            payload: { type: "candidate", payload: candidate.toJSON(), from: "agent" }
          });
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signalingCh.send({
          type: "broadcast", event: "signal",
          payload: { type: "offer", payload: offer, from: "agent" }
        });

        // Notificar UI
        mainWindow?.webContents.send("agent:viewer-connected");
      }

      if (payload.type === "answer" && pc)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));

      if (payload.type === "candidate" && pc)
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.payload)); } catch {}
    })
    .subscribe();

  controlCh
    .on("broadcast", { event: "control" }, ({ payload }) => handleControl(payload))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await controlCh.track({ online_at: new Date().toISOString() });
        mainWindow?.webContents.send("agent:ready");
      }
    });

  // Retorna función para detener
  return () => {
    captureRunning = false;
    pc?.close();
    supabase.removeChannel(signalingCh);
    supabase.removeChannel(controlCh);
    mainWindow?.webContents.send("agent:stopped");
  };
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
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
