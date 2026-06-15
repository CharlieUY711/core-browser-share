const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("coreAgent", {
  start: (sessionCode) => ipcRenderer.invoke("agent:start", sessionCode),
  stop: () => ipcRenderer.invoke("agent:stop"),
  status: () => ipcRenderer.invoke("agent:status"),
  onReady: (cb) => ipcRenderer.on("agent:ready", cb),
  onViewerConnected: (cb) => ipcRenderer.on("agent:viewer-connected", cb),
  onStopped: (cb) => ipcRenderer.on("agent:stopped", cb),
});
