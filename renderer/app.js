const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  connectionLabel: $("#connectionLabel"),
  connectionDot: $("#connectionDot"),
  connectButton: $("#connectButton"),
  messages: $("#messages"),
  composer: $("#composer"),
  messageInput: $("#messageInput"),
  sendButton: $("#sendButton"),
  activityPill: $("#activityPill"),
  activityText: $("#activityText"),
  projectBoardButton: $("#projectBoardButton"),
  projectBoardModal: $("#projectBoardModal"),
  closeProjectBoard: $("#closeProjectBoard"),
  projectImageUpload: $("#projectImageUpload"),
  projectImageGrid: $("#projectImageGrid"),
  projectAudioUpload: $("#projectAudioUpload"),
  projectSongForm: $("#projectSongForm"),
  projectSongList: $("#projectSongList"),
  projectTrackForm: $("#projectTrackForm"),
  projectTrackInput: $("#projectTrackInput"),
  projectTrackList: $("#projectTrackList"),
  projectLyrics: $("#projectLyrics"),
  projectSongNames: $("#projectSongNames"),
  projectIdeas: $("#projectIdeas"),
  settingsModal: $("#settingsModal"),
  settingsButton: $("#settingsButton"),
  closeSettings: $("#closeSettings"),
  apiKeyInput: $("#apiKeyInput"),
  keyHint: $("#keyHint"),
  modelSelect: $("#modelSelect"),
  reasoningSelect: $("#reasoningSelect"),
  saveSettingsButton: $("#saveSettingsButton"),
  removeKeyButton: $("#removeKeyButton"),
  newChatButton: $("#newChatButton"),
  approvalModal: $("#approvalModal"),
  approvalTitle: $("#approvalTitle"),
  approvalSummary: $("#approvalSummary"),
  acceptApproval: $("#acceptApproval"),
  declineApproval: $("#declineApproval"),
  toast: $("#toast"),
  versionLabel: $("#versionLabel"),
  beatLibrary: $("#beatLibrary"),
  beatPlayer: $("#beatPlayer"),
  playBeatButton: $("#playBeatButton"),
  pauseBeatButton: $("#pauseBeatButton"),
  beatCount: $("#beatCount"),
  openBeatFolderButton: $("#openBeatFolderButton"),
  beatUrlInput: $("#beatUrlInput"),
  beatPreview: $("#beatPreview"),
  downloadBeatButton: $("#downloadBeatButton"),
  refreshBeatsButton: $("#refreshBeatsButton"),
  importBeatButton: $("#importBeatButton")
};

let sending = false;
let currentApproval = null;
let toastTimer;
let beatMetadata = null;
let beatFiles = [];
let selectedBeatPath = "";

const creativePrompts = {
  single: "Develop one Plecat Mood single. Give me the sonic brief, emotional premise, title options, arrangement arc, lyric direction, cover concept, video treatment, short-form asset list, and the next three Logic steps.",
  album: "Develop the complete Plecat Mood album world: chapter arc, tracklist, sequencing logic, sonic palette, visual system, anchor artifact, and a practical 90-day rollout.",
  lyrics: "Write a Plecat Mood lyric direction for a song about absence, return, or someone leaving. Keep it restrained, concrete, cinematic, and emotionally honest; include a verse, pre-chorus, chorus, and bridge seed.",
  visuals: "Build a Plecat Mood visual brief for the next song: palette, materials, locations, camera language, typography, cover treatment, and music-video treatment.",
  rollout: "Turn the Plecat Mood 90-day rollout into a concrete release schedule for the next single or album, including assets, captions, platform roles, dependencies, and readiness checks."
};

const PROJECT_STORAGE_KEY = "studiochat-plecat-project-v1";
let projectState = loadProjectState();

function emptyProjectState() {
  return { images: [], songs: [], tracklist: [], lyrics: "", songNames: "", ideas: "", updatedAt: new Date().toISOString() };
}

function loadProjectState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY) || "null");
    if (!saved) return emptyProjectState();
    return {
      ...emptyProjectState(),
      ...saved,
      images: Array.isArray(saved.images) ? saved.images : [],
      songs: Array.isArray(saved.songs) ? saved.songs : [],
      tracklist: Array.isArray(saved.tracklist) ? saved.tracklist : []
    };
  } catch (error) {
    console.warn("Could not load local Plecat Mood project state.", error);
    return emptyProjectState();
  }
}

function saveProjectState() {
  projectState.updatedAt = new Date().toISOString();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectState));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function removeProjectItem(collection, id) {
  projectState[collection] = projectState[collection].filter((item) => item.id !== id);
  saveProjectState();
  renderProjectBoard();
}

function renderProjectBoard() {
  elements.projectImageGrid.replaceChildren();
  if (!projectState.images.length) {
    const empty = document.createElement("p");
    empty.className = "project-empty";
    empty.textContent = "No images yet. Add the visual world here.";
    elements.projectImageGrid.append(empty);
  }
  for (const image of projectState.images) {
    const card = document.createElement("article");
    card.className = "project-image-card";
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = image.name || "Plecat Mood reference";
    const title = document.createElement("span");
    title.textContent = image.name || "Untitled reference";
    const note = document.createElement("textarea");
    note.rows = 2;
    note.placeholder = "Image note";
    note.value = image.note || "";
    note.addEventListener("input", () => { image.note = note.value; saveProjectState(); });
    const remove = document.createElement("button");
    remove.className = "project-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeProjectItem("images", image.id));
    card.append(img, title, note, remove);
    elements.projectImageGrid.append(card);
  }

  elements.projectSongList.replaceChildren();
  for (const song of projectState.songs) {
    const card = document.createElement("article");
    card.className = "project-song-card";
    const title = document.createElement("strong");
    title.textContent = song.title || "Untitled reference";
    const meta = document.createElement("span");
    meta.textContent = song.artist || "Reference audio";
    card.append(title, meta);
    if (song.src) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = song.src;
      card.append(audio);
    }
    if (song.link) {
      const link = document.createElement("a");
      link.href = song.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open link";
      card.append(link);
    }
    if (song.note) {
      const note = document.createElement("p");
      note.textContent = song.note;
      card.append(note);
    }
    const remove = document.createElement("button");
    remove.className = "project-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeProjectItem("songs", song.id));
    card.append(remove);
    elements.projectSongList.append(card);
  }

  elements.projectTrackList.replaceChildren();
  projectState.tracklist.forEach((track, index) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = track.name;
    const remove = document.createElement("button");
    remove.className = "project-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeProjectItem("tracklist", track.id));
    item.append(name, remove);
    item.value = index + 1;
    elements.projectTrackList.append(item);
  });

  elements.projectLyrics.value = projectState.lyrics;
  elements.projectSongNames.value = projectState.songNames;
  elements.projectIdeas.value = projectState.ideas;
}

function openProjectBoard() {
  renderProjectBoard();
  elements.projectBoardModal.classList.remove("hidden");
}

function closeProjectBoard() {
  elements.projectBoardModal.classList.add("hidden");
}

function setConnection(status) {
  const state = status.state || (status.connected ? "connected" : "idle");
  elements.connectionDot.className = `status-dot ${state}`;
  if (state === "connected") {
    elements.connectionLabel.textContent = `Connected · ${status.toolCount || 0} tools`;
    elements.connectButton.textContent = "Reconnect";
  } else if (state === "connecting") {
    elements.connectionLabel.textContent = "Connecting…";
    elements.connectButton.textContent = "Connecting…";
  } else if (state === "error") {
    elements.connectionLabel.textContent = "Connection failed";
    elements.connectButton.textContent = "Try again";
  } else {
    elements.connectionLabel.textContent = "Not connected";
    elements.connectButton.textContent = "Connect";
  }
}

function showActivity(text) {
  elements.activityText.textContent = text;
  elements.activityPill.classList.remove("hidden");
}

function hideActivity() {
  elements.activityPill.classList.add("hidden");
}

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast${error ? " error" : ""}`;
  toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 4200);
}

function removeWelcome() {
  elements.messages.querySelector(".welcome-card")?.remove();
}

function appendMessage(role, text) {
  removeWelcome();
  const row = document.createElement("article");
  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "SP";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.append(avatar, bubble);
  elements.messages.append(row);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

async function connectLogic() {
  elements.connectButton.disabled = true;
  setConnection({ state: "connecting" });
  try {
    const status = await window.studiochat.connectLogic();
    setConnection(status);
    if (status.state === "error") showToast(status.message, true);
    else showToast("Logic Pro connected.");
  } finally {
    elements.connectButton.disabled = false;
  }
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message || sending) return;
  sending = true;
  elements.sendButton.disabled = true;
  elements.messageInput.disabled = true;
  appendMessage("user", message);
  elements.messageInput.value = "";
  resizeComposer();
  showActivity("Thinking");

  try {
    const result = await window.studiochat.sendMessage(message);
    appendMessage("assistant", result.text);
  } catch (error) {
    appendMessage("assistant", `I couldn't complete that: ${error.message}`);
  } finally {
    sending = false;
    elements.sendButton.disabled = false;
    elements.messageInput.disabled = false;
    elements.messageInput.focus();
    hideActivity();
  }
}

async function runQuickAction(action, button) {
  const previous = button?.textContent;
  if (button) button.disabled = true;
  showActivity(`Running ${action}`);
  try {
    const result = await window.studiochat.runQuickAction(action);
    if (["audit", "health"].includes(action)) {
      appendMessage("assistant", result.text);
    } else {
      showToast(result.ok ? "Logic action completed." : result.text, !result.ok);
    }
  } catch (error) {
    showToast(error.message, true);
  } finally {
    hideActivity();
    if (button) {
      button.disabled = false;
      if (previous) button.textContent = previous;
    }
  }
}

async function loadBeatInbox() {
  elements.refreshBeatsButton.disabled = true;
  try {
    beatFiles = await window.studiochat.listBeatInbox();
    elements.beatCount.textContent = `${beatFiles.length} ${beatFiles.length === 1 ? "beat" : "beats"}`;
    if (!beatFiles.length) {
      selectedBeatPath = "";
      elements.importBeatButton.disabled = true;
      elements.playBeatButton.disabled = true;
      elements.pauseBeatButton.disabled = true;
      renderBeatLibrary();
      return;
    }
    if (!beatFiles.some((file) => file.path === selectedBeatPath)) selectedBeatPath = beatFiles[0].path;
    renderBeatLibrary();
    elements.importBeatButton.disabled = false;
    elements.playBeatButton.disabled = false;
    elements.pauseBeatButton.disabled = false;
  } catch (error) {
    elements.importBeatButton.disabled = true;
    showToast(`Could not load Beat Inbox: ${error.message}`, true);
  } finally {
    elements.refreshBeatsButton.disabled = false;
  }
}

function renderBeatLibrary() {
  // Rebuilding the list is convenient when a card is selected, but without
  // restoring this value a selection near the end of the inbox jumps back to
  // the first beat.
  const scrollTop = elements.beatLibrary.scrollTop;
  elements.beatLibrary.replaceChildren();
  if (!beatFiles.length) {
    const empty = document.createElement("p");
    empty.className = "beat-empty";
    empty.textContent = "No downloaded beats yet.";
    elements.beatLibrary.append(empty);
    return;
  }
  for (const file of beatFiles) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `beat-card${file.path === selectedBeatPath ? " selected" : ""}`;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", String(file.path === selectedBeatPath));
    card.tabIndex = file.path === selectedBeatPath ? 0 : -1;
    const image = document.createElement("div");
    image.className = "beat-cover";
    if (file.coverUrl) {
      const img = document.createElement("img");
      img.src = file.coverUrl;
      img.alt = "";
      image.append(img);
    } else image.textContent = "♫";
    const copy = document.createElement("span");
    copy.className = "beat-copy";
    const name = document.createElement("span");
    name.className = "beat-name";
    name.textContent = file.name.replace(/\.mp3$/i, "");
    const size = document.createElement("span");
    size.className = "beat-meta";
    size.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    copy.append(name, size);
    card.append(image, copy);
    card.addEventListener("click", () => selectBeat(file.path, true));
    card.addEventListener("keydown", (event) => {
      const index = beatFiles.findIndex((beat) => beat.path === file.path);
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, beatFiles.length - 1);
      else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = beatFiles.length - 1;
      else return;
      event.preventDefault();
      selectBeat(beatFiles[nextIndex].path, true);
    });
    elements.beatLibrary.append(card);
  }
  elements.beatLibrary.scrollTop = scrollTop;
}

function selectBeat(filePath, focus = false) {
  if (selectedBeatPath !== filePath) stopBeatPreview();
  selectedBeatPath = filePath;
  renderBeatLibrary();
  if (!focus) return;
  const selectedCard = elements.beatLibrary.querySelector(".beat-card.selected");
  selectedCard?.focus({ preventScroll: true });
  selectedCard?.scrollIntoView({ block: "nearest" });
}

async function previewSelectedBeat() {
  const filePath = selectedBeatPath;
  if (!filePath) return;
  elements.playBeatButton.disabled = true;
  try {
    const previewUrl = await window.studiochat.getBeatPreviewUrl(filePath);
    if (elements.beatPlayer.src !== previewUrl) elements.beatPlayer.src = previewUrl;
    elements.beatPlayer.currentTime = 0;
    await elements.beatPlayer.play();
  } catch (error) {
    showToast(`Could not play beat: ${error.message}`, true);
  } finally {
    elements.playBeatButton.disabled = false;
  }
}

function stopBeatPreview() {
  elements.beatPlayer.pause();
  elements.beatPlayer.currentTime = 0;
  elements.pauseBeatButton.textContent = "Pause / Resume";
}

async function importSelectedBeat() {
  const filePath = selectedBeatPath;
  if (!filePath) return;
  elements.importBeatButton.disabled = true;
  showActivity("Preparing Logic import");
  try {
    const result = await window.studiochat.importBeat(filePath);
    showToast(result.text, !result.ok);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.importBeatButton.disabled = false;
    hideActivity();
  }
}

function resetBeatPreview() {
  beatMetadata = null;
  elements.beatPreview.textContent = "MP3 + cover image will be saved locally.";
}

async function downloadBeat() {
  const url = elements.beatUrlInput.value.trim();
  if (!url) return showToast("Paste a YouTube link first.", true);
  elements.downloadBeatButton.disabled = true;
  showActivity("Fetching beat details");
  try {
    beatMetadata = await window.studiochat.inspectBeat(url);
    const duration = beatMetadata.duration ? ` · ${Math.floor(beatMetadata.duration / 60)}:${String(Math.floor(beatMetadata.duration % 60)).padStart(2, "0")}` : "";
    elements.beatPreview.textContent = `${beatMetadata.title}${beatMetadata.uploader ? ` — ${beatMetadata.uploader}` : ""}${duration}`;
    showActivity("Downloading MP3 + cover");
    const file = await window.studiochat.downloadBeat({ url, title: beatMetadata.title });
    await loadBeatInbox();
    selectedBeatPath = file.path;
    renderBeatLibrary();
    showToast(`Added ${file.name} to Beat Inbox.`);
    elements.beatUrlInput.value = "";
    resetBeatPreview();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.downloadBeatButton.disabled = false;
    hideActivity();
  }
}

async function openSettings() {
  const settings = await window.studiochat.getSettings();
  elements.apiKeyInput.value = "";
  elements.apiKeyInput.placeholder = settings.hasAPIKey
    ? "Key saved securely"
    : "sk-…";
  elements.keyHint.textContent = settings.hasAPIKey
    ? "A key is saved securely. Enter a new one only to replace it."
    : "Stored securely using macOS encryption.";
  elements.modelSelect.value = settings.model;
  elements.reasoningSelect.value = settings.reasoningEffort;
  elements.settingsModal.classList.remove("hidden");
}

function closeSettings() {
  elements.settingsModal.classList.add("hidden");
}

async function saveSettings(removeKey = false) {
  try {
    const settings = await window.studiochat.saveSettings({
      apiKey: removeKey ? "" : elements.apiKeyInput.value || undefined,
      model: elements.modelSelect.value,
      reasoningEffort: elements.reasoningSelect.value
    });
    closeSettings();
    showToast(settings.hasAPIKey ? "Settings saved securely." : "API key removed.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function resizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 120)}px`;
}

function showApproval(request) {
  currentApproval = request;
  elements.approvalTitle.textContent = request.title;
  elements.approvalSummary.textContent = request.summary;
  elements.approvalModal.classList.remove("hidden");
}

function answerApproval(approved) {
  if (!currentApproval) return;
  window.studiochat.respondToApproval(currentApproval.id, approved);
  currentApproval = null;
  elements.approvalModal.classList.add("hidden");
}

elements.connectButton.addEventListener("click", connectLogic);
elements.downloadBeatButton.addEventListener("click", downloadBeat);
elements.beatUrlInput.addEventListener("input", resetBeatPreview);
elements.refreshBeatsButton.addEventListener("click", loadBeatInbox);
elements.playBeatButton.addEventListener("click", previewSelectedBeat);
elements.pauseBeatButton.addEventListener("click", () => {
  if (elements.beatPlayer.paused) void elements.beatPlayer.play();
  else elements.beatPlayer.pause();
});
elements.openBeatFolderButton.addEventListener("click", () => window.studiochat.openBeatFolder());
elements.beatPlayer.addEventListener("play", () => { elements.pauseBeatButton.textContent = "Pause"; });
elements.beatPlayer.addEventListener("pause", () => { elements.pauseBeatButton.textContent = "Resume"; });
elements.beatPlayer.addEventListener("ended", stopBeatPreview);
elements.importBeatButton.addEventListener("click", importSelectedBeat);
elements.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendMessage(elements.messageInput.value);
});
elements.messageInput.addEventListener("input", resizeComposer);
elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendMessage(elements.messageInput.value);
  }
});

$$("[data-action]").forEach((button) => {
  button.addEventListener("click", () =>
    runQuickAction(button.dataset.action, button)
  );
});

$$("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

$$("[data-creative-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(creativePrompts[button.dataset.creativePrompt]));
});

elements.settingsButton.addEventListener("click", openSettings);
elements.projectBoardButton.addEventListener("click", openProjectBoard);
elements.closeProjectBoard.addEventListener("click", closeProjectBoard);
elements.projectBoardModal.addEventListener("click", (event) => {
  if (event.target === elements.projectBoardModal) closeProjectBoard();
});
$$('[data-project-tab]').forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.projectTab;
    $$('[data-project-tab]').forEach((item) => item.classList.toggle("active", item === button));
    $$('[data-project-pane]').forEach((pane) => pane.classList.toggle("active", pane.dataset.projectPane === tab));
  });
});
elements.projectImageUpload.addEventListener("change", async (event) => {
  try {
    for (const file of [...event.target.files]) {
      projectState.images.push({ id: crypto.randomUUID(), name: file.name, src: await readFileAsDataUrl(file), note: "" });
    }
    saveProjectState();
    renderProjectBoard();
  } catch (error) {
    showToast(`Could not add image: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
});
elements.projectAudioUpload.addEventListener("change", async (event) => {
  try {
    for (const file of [...event.target.files]) {
      projectState.songs.push({ id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ""), artist: "Local audio", src: await readFileAsDataUrl(file), link: "", note: "" });
    }
    saveProjectState();
    renderProjectBoard();
  } catch (error) {
    showToast(`Could not add audio: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
});
elements.projectSongForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(elements.projectSongForm);
  if (!["title", "artist", "link", "note"].some((key) => String(data.get(key) || "").trim())) return;
  projectState.songs.push({ id: crypto.randomUUID(), title: String(data.get("title") || "").trim(), artist: String(data.get("artist") || "").trim(), link: String(data.get("link") || "").trim(), note: String(data.get("note") || "").trim(), src: "" });
  elements.projectSongForm.reset();
  saveProjectState();
  renderProjectBoard();
});
elements.projectTrackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.projectTrackInput.value.trim();
  if (!name) return;
  projectState.tracklist.push({ id: crypto.randomUUID(), name });
  elements.projectTrackInput.value = "";
  saveProjectState();
  renderProjectBoard();
});
for (const [field, key] of [[elements.projectLyrics, "lyrics"], [elements.projectSongNames, "songNames"], [elements.projectIdeas, "ideas"]]) {
  field.addEventListener("input", () => { projectState[key] = field.value; saveProjectState(); });
}
elements.closeSettings.addEventListener("click", closeSettings);
elements.saveSettingsButton.addEventListener("click", () => saveSettings(false));
elements.removeKeyButton.addEventListener("click", () => saveSettings(true));
elements.newChatButton.addEventListener("click", async () => {
  await window.studiochat.resetConversation();
  elements.messages.innerHTML = "";
  appendMessage("assistant", "New conversation started. What are we making for Plecat Mood?");
});
elements.acceptApproval.addEventListener("click", () => answerApproval(true));
elements.declineApproval.addEventListener("click", () => answerApproval(false));

window.studiochat.onStatus(setConnection);
window.studiochat.onActivity(showActivity);
window.studiochat.onApproval(showApproval);

async function bootstrap() {
  const state = await window.studiochat.getBootstrap();
  elements.versionLabel.textContent = `studiochat MVP · ${state.version}`;
  setConnection(state.logic);
  void loadBeatInbox();
  void connectLogic();
}

void bootstrap();
