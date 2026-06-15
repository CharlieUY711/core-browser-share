const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { fork } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEB_URL = process.env.WEB_URL || "https://compartir.core.com.uy";

let pickerWindow = null;
let sessionWindow = null;
let tray = null;
let agentProcess = null;
let selectedSourceId = null;

function createPickerWindow() {
  pickerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    backgroundColor: "#0f0f17",
    title: "Core — Compartir pantalla",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pickerWindow.loadFile(path.join(__dirname, "picker.html"));
  pickerWindow.on("closed", () => { pickerWindow = null; });
}

async function createSessionWindow(sessionCode) {
  sessionWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: "#0f0f17",
    title: "Core — Sesión " + sessionCode,
    webPreferences: {
      preload: path.join(__dirname, "preload-session.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Interceptar getDisplayMedia — usar fuente seleccionada
  sessionWindow.webContents.session.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ["screen", "window"] }).then(sources => {
      const src = sources.find(s => s.id === selectedSourceId) || sources[0];
      callback({ video: src });
    });
  });

  // Navegar directo a la sesión como host
  sessionWindow.loadURL(`${WEB_URL}/session/${sessionCode}?role=host&electron=1`);

  sessionWindow.on("closed", () => {
    sessionWindow = null;
    stopAgent();
  });
}

function stopAgent() {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
}

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

ipcMain.handle("select-source", async (_e, sourceId) => {
  selectedSourceId = sourceId;
  const sessionCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Crear sesión en Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await supabase.from("sessions").insert({ code: sessionCode }).catch(() => {});

  pickerWindow?.close();

  // Agente en proceso separado
  agentProcess = fork(path.join(__dirname, "agent.js"), [], {
    env: {
      ...process.env,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      SESSION_CODE: sessionCode,
    },
    silent: true,
  });
  agentProcess.stdout?.on("data", d => console.log("[agent]", d.toString().trim()));
  agentProcess.stderr?.on("data", d => console.error("[agent]", d.toString().trim()));

  await createSessionWindow(sessionCode);
  return { sessionCode };
});

ipcMain.handle("agent:stop", () => { stopAgent(); return { ok: true }; });

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../assets/icon.png")).resize({ width: 16 });
    tray = new Tray(icon);
    tray.setToolTip("Core");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Compartir pantalla", click: () => { if (!pickerWindow) createPickerWindow(); else pickerWindow.focus(); } },
      { type: "separator" },
      { label: "Salir", click: () => app.quit() },
    ]));
  } catch {}
}

app.whenReady().then(() => {
  createPickerWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { stopAgent(); });
