const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("coreDesktop", {
  // Listar pantallas/ventanas disponibles
  getSources: () => ipcRenderer.invoke("get-sources"),
  // Agente de control
  startAgent: (sessionCode) => ipcRenderer.invoke("agent:start", sessionCode),
  stopAgent: () => ipcRenderer.invoke("agent:stop"),
  // Eventos del agente
  onAgentReady: (cb) => ipcRenderer.on("agent:ready", (_e, data) => cb(data)),
  onAgentStopped: (cb) => ipcRenderer.on("agent:stopped", cb),
  // Detectar si estamos en Electron
  isElectron: true,
});
