import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { LogicService } from "./logic-service.js";
import { CodexService } from "./codex-service.js";
import { SettingsStore } from "./settings-store.js";
import { createdTrackIndex, toolResultText } from "./core.js";
import { AudioImportService, ensurePlayablePreview } from "./audio-import-service.js";
import { BeatDownloadService } from "./beat-download-service.js";
import { AlbumLibraryService } from "./album-library-service.js";
import { SoundLibraryService } from "./sound-library-service.js";
import { ChannelStripPresetService } from "./channel-strip-preset-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let logicService;
const audioImportService = new AudioImportService(
  "/Users/vicorico/code/reclip/downloads"
);
const beatDownloadService = new BeatDownloadService(
  "/Users/vicorico/code/reclip/downloads"
);
const albumLibraryService = new AlbumLibraryService(
  "/Users/vicorico/Desktop/PLECAT"
);
let mainWindow;
let settingsStore;
let codexService;
let soundLibraryService;
const channelStripPresetService = new ChannelStripPresetService();
let approvalSequence = 0;
const pendingApprovals = new Map();

function createWindow() {
  nativeTheme.themeSource = "dark";
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#0b0d12",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

function requestApproval(payload) {
  return new Promise((resolve) => {
    const id = `approval-${Date.now()}-${approvalSequence++}`;
    pendingApprovals.set(id, resolve);
    mainWindow.webContents.send("approval:request", { id, ...payload });
  });
}

function emitStatus(value) {
  mainWindow?.webContents.send("logic:status", value);
}

function registerIPC() {
  ipcMain.handle("app:bootstrap", async () => ({
    logic: logicService.status(),
    logicMcpVersion: await logicService.version(),
    settings: settingsStore.getPublicSettings(),
    version: app.getVersion()
  }));

  ipcMain.handle("logic:connect", async () => {
    emitStatus({ state: "connecting" });
    try {
      const status = await logicService.connect();
      const value = { state: "connected", ...status };
      emitStatus(value);
      return value;
    } catch (error) {
      const value = { state: "error", message: error.message };
      emitStatus(value);
      return value;
    }
  });

  ipcMain.handle("logic:quick-action", async (_event, action) => {
    const actions = {
      health: ["logic_system", { command: "health", params: {} }],
      play: ["logic_transport", { command: "play", params: {} }],
      stop: ["logic_transport", { command: "stop", params: {} }],
      rewind: ["logic_transport", { command: "rewind", params: {} }],
      audit: ["logic_project", { command: "audit", params: {} }],
      selectMic: ["logic_tracks", { command: "select", params: { index: 0 } }]
    };
    if (!actions[action]) throw new Error("Unknown quick action.");
    const [tool, args] = actions[action];
    const result = await logicService.callTool(tool, args);
    return { ok: !result.isError, text: toolResultText(result) };
  });

  ipcMain.handle("beat-inbox:list", async () => {
    const files = await audioImportService.listFiles();
    return files.map((file) => ({
      ...file,
      coverUrl: file.coverPath ? pathToFileURL(file.coverPath).href : null
    }));
  });
  ipcMain.handle("album-library:list", () => albumLibraryService.inventory());
  ipcMain.handle("album-library:preview-url", async (_event, filePath) =>
    pathToFileURL(await ensurePlayablePreview(await albumLibraryService.permittedAudioPath(filePath), { cacheSource: true })).href
  );
  ipcMain.handle("album-library:open-folder", async () => {
    await shell.openPath("/Users/vicorico/Desktop/PLECAT");
  });

  ipcMain.handle("sounds:list", () => soundLibraryService.list());
  ipcMain.handle("sounds:download", (_event, value) => soundLibraryService.download(value));
  ipcMain.handle("sounds:generate-midi", (_event, value) => soundLibraryService.generateMidi(value));
  ipcMain.handle("sounds:reveal", async (_event, filePath) => {
    const items = await soundLibraryService.list();
    if (!items.some((item) => item.path === filePath)) throw new Error("That sound-library item is no longer available.");
    shell.showItemInFolder(filePath);
    return { ok: true };
  });
  ipcMain.handle("sounds:add-local", async (_event, type) => {
    const filters = type === "midi"
      ? [{ name: "MIDI", extensions: ["mid", "midi"] }]
      : [{ name: "Logic presets", extensions: ["cst", "patch", "pst"] }];
    const selection = await dialog.showOpenDialog(mainWindow, { properties: ["openFile", "multiSelections"], filters });
    if (selection.canceled) return [];
    return soundLibraryService.importLocal(selection.filePaths, type);
  });
  ipcMain.handle("sounds:apply-midi", async (_event, { filePath, bar = 1 }) => {
    const sequence = await soundLibraryService.midiSequence(filePath);
    const approved = await requestApproval({
      title: "Add MIDI to Logic?",
      summary: `Create a new Logic instrument track containing ${sequence.noteCount} notes at bar ${bar}.`,
      toolName: "logic_tracks",
      arguments: { command: "record_sequence", bar, noteCount: sequence.noteCount }
    });
    if (!approved) return { ok: false, text: "MIDI import cancelled." };
    const result = await logicService.callTool("logic_tracks", { command: "record_sequence", params: { bar: Number(bar), notes: sequence.notes, tempo: sequence.tempo } });
    return { ok: !result.isError, text: toolResultText(result) };
  });
  ipcMain.handle("sounds:apply-preset", async (_event, { filePath, type, track = 0 }) => {
    const preset = await soundLibraryService.preparePreset(filePath, type);
    const approved = await requestApproval({
      title: "Load preset into Logic?",
      summary: `Load “${preset.presetName}” onto Logic track ${Number(track) + 1}. This replaces that channel strip's current setting.`,
      toolName: "channel_strip_preset",
      arguments: { track: Number(track), preset: preset.presetName }
    });
    if (!approved) return { ok: false, text: "Preset load cancelled." };
    const selected = await logicService.callTool("logic_tracks", { command: "select", params: { index: Number(track) } });
    if (selected.isError) throw new Error(`Could not select Logic track ${Number(track) + 1}: ${toolResultText(selected)}`);
    return channelStripPresetService.apply(preset);
  });
  ipcMain.handle("beat-inbox:preview-url", async (_event, filePath) => {
    const files = await audioImportService.listFiles();
    const selected = files.find((file) => file.path === filePath);
    if (!selected) throw new Error("That audio file is no longer in the Beat Inbox.");
    return pathToFileURL(await audioImportService.playablePreviewPath(selected.path)).href;
  });
  ipcMain.handle("beat-inbox:open-folder", async () => {
    const { shell } = await import("electron");
    await shell.openPath("/Users/vicorico/code/reclip/downloads");
  });
  ipcMain.handle("beat:inspect", async (_event, url) => beatDownloadService.inspect(url));
  ipcMain.handle("beat:download", async (_event, { url, title }) =>
    beatDownloadService.download(url, title)
  );

  ipcMain.handle("beat-inbox:import", async (_event, filePath) => {
    const files = await audioImportService.listFiles();
    const selected = files.find((file) => file.path === filePath);
    if (!selected) throw new Error("That audio file is no longer in the Beat Inbox.");
    const approved = await requestApproval({
      title: "Import beat into Logic?",
      summary: `Create a new audio track, then import “${selected.name}” onto it in the open Logic project.`,
      toolName: "macos_audio_import",
      arguments: { path: selected.path }
    });
    if (!approved) return { ok: false, text: "Import cancelled." };
    await logicService.connect();
    const createResult = await logicService.callTool("logic_tracks", {
      command: "create_audio",
      params: {}
    });
    if (createResult.isError) {
      throw new Error(`Could not create a new Logic audio track: ${toolResultText(createResult)}`);
    }

    const trackIndex = createdTrackIndex(createResult);
    if (trackIndex !== null) {
      const selectResult = await logicService.callTool("logic_tracks", {
        command: "select",
        params: { index: trackIndex }
      });
      if (selectResult.isError) {
        throw new Error(`Created a new audio track, but could not select it: ${toolResultText(selectResult)}`);
      }
    }

    const result = await audioImportService.importIntoLogic(selected.path);
    return {
      ...result,
      text: trackIndex === null
        ? `${result.text} Logic selected the newly created audio track.`
        : `${result.text} Imported onto new audio track ${trackIndex + 1}.`
    };
  });

  ipcMain.handle("chat:send", async (_event, message) => {
    return codexService.sendMessage(message, (activity) => {
      mainWindow.webContents.send("chat:activity", activity);
    });
  });

  ipcMain.handle("chat:reset", () => {
    codexService.resetConversation();
    return { ok: true };
  });

  ipcMain.handle("settings:get", () => settingsStore.getPublicSettings());
  ipcMain.handle("settings:save", (_event, value) =>
    settingsStore.save(value)
  );

  ipcMain.on("approval:response", (_event, { id, approved }) => {
    const resolve = pendingApprovals.get(id);
    if (!resolve) return;
    pendingApprovals.delete(id);
    resolve(Boolean(approved));
  });
}

app.whenReady().then(() => {
  settingsStore = new SettingsStore();
  const privateMcpDirectory = path.join(app.getPath("userData"), "logic-pro-mcp", "3.15.0");
  logicService = new LogicService({
    binary: path.join(privateMcpDirectory, "LogicProMCP"),
    shareDirectory: privateMcpDirectory
  });
  soundLibraryService = new SoundLibraryService({
    storageDirectory: path.join(app.getPath("userData"), "sounds"),
    userMusicDirectory: app.getPath("music")
  });
  codexService = new CodexService({ cwd: app.getPath("userData") });
  registerIPC();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  for (const resolve of pendingApprovals.values()) resolve(false);
  pendingApprovals.clear();
  void logicService.close();
});
