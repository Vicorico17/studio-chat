const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studiochat", {
  getBootstrap: () => ipcRenderer.invoke("app:bootstrap"),
  connectLogic: () => ipcRenderer.invoke("logic:connect"),
  runQuickAction: (action) => ipcRenderer.invoke("logic:quick-action", action),
  listBeatInbox: () => ipcRenderer.invoke("beat-inbox:list"),
  listAlbumLibrary: () => ipcRenderer.invoke("album-library:list"),
  getAlbumPreviewUrl: (filePath) => ipcRenderer.invoke("album-library:preview-url", filePath),
  openAlbumFolder: () => ipcRenderer.invoke("album-library:open-folder"),
  listSounds: () => ipcRenderer.invoke("sounds:list"),
  installFactoryVocals: () => ipcRenderer.invoke("sounds:install-factory-vocals"),
  downloadSound: (value) => ipcRenderer.invoke("sounds:download", value),
  generateMidi: (value) => ipcRenderer.invoke("sounds:generate-midi", value),
  addLocalSounds: (type) => ipcRenderer.invoke("sounds:add-local", type),
  revealSound: (filePath) => ipcRenderer.invoke("sounds:reveal", filePath),
  applyMidi: (value) => ipcRenderer.invoke("sounds:apply-midi", value),
  applyPreset: (value) => ipcRenderer.invoke("sounds:apply-preset", value),
  getBeatPreviewUrl: (filePath) => ipcRenderer.invoke("beat-inbox:preview-url", filePath),
  openBeatFolder: () => ipcRenderer.invoke("beat-inbox:open-folder"),
  importBeat: (filePath) => ipcRenderer.invoke("beat-inbox:import", filePath),
  inspectBeat: (url) => ipcRenderer.invoke("beat:inspect", url),
  downloadBeat: (value) => ipcRenderer.invoke("beat:download", value),
  sendMessage: (message) => ipcRenderer.invoke("chat:send", message),
  resetConversation: () => ipcRenderer.invoke("chat:reset"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  respondToApproval: (id, approved) =>
    ipcRenderer.send("approval:response", { id, approved }),
  onStatus: (callback) =>
    ipcRenderer.on("logic:status", (_event, value) => callback(value)),
  onActivity: (callback) =>
    ipcRenderer.on("chat:activity", (_event, value) => callback(value)),
  onApproval: (callback) =>
    ipcRenderer.on("approval:request", (_event, value) => callback(value))
});
