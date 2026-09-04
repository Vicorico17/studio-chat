const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  connectionLabel: $("#connectionLabel"),
  connectionDot: $("#connectionDot"),
  connectionCard: $("#connectionCard"),
  connectionDetail: $("#connectionDetail"),
  connectButton: $("#connectButton"),
  mcpVersionLabel: $("#mcpVersionLabel"),
  singleModeButton: $("#singleModeButton"),
  albumModeButton: $("#albumModeButton"),
  workspaceTitle: $("#workspaceTitle"),
  workspaceSubtitle: $("#workspaceSubtitle"),
  nextFrameTitle: $("#nextFrameTitle"),
  moodboardCanvas: $("#moodboardCanvas"),
  focusMoodboardButton: $("#focusMoodboardButton"),
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
  albumLibrarySummary: $("#albumLibrarySummary"),
  albumSongCount: $("#albumSongCount"),
  albumBeatCount: $("#albumBeatCount"),
  albumOtherCount: $("#albumOtherCount"),
  albumLibraryList: $("#albumLibraryList"),
  albumPlayer: $("#albumPlayer"),
  openAlbumFolderButton: $("#openAlbumFolderButton"),
  plecatBeatCount: $("#plecatBeatCount"),
  plecatBeatList: $("#plecatBeatList"),
  openPlecatBeatFolderButton: $("#openPlecatBeatFolderButton"),
  favoriteBeatCount: $("#favoriteBeatCount"),
  favoriteBeatList: $("#favoriteBeatList"),
  favoriteBeatPlayer: $("#favoriteBeatPlayer"),
  playerNowTitle: $("#playerNowTitle"),
  playerNowSource: $("#playerNowSource"),
  playerPreviousButton: $("#playerPreviousButton"),
  playerPlayButton: $("#playerPlayButton"),
  playerStopButton: $("#playerStopButton"),
  playerNextButton: $("#playerNextButton"),
  playerSeek: $("#playerSeek"),
  playerCurrentTime: $("#playerCurrentTime"),
  playerDuration: $("#playerDuration"),
  soundsCount: $("#soundsCount"),
  soundsSearch: $("#soundsSearch"),
  soundsTrack: $("#soundsTrack"),
  midiBarLabel: $("#midiBarLabel"),
  midiStartBar: $("#midiStartBar"),
  addLocalSoundButton: $("#addLocalSoundButton"),
  soundDownloadForm: $("#soundDownloadForm"),
  soundUrlInput: $("#soundUrlInput"),
  midiGeneratorForm: $("#midiGeneratorForm"),
  midiRoot: $("#midiRoot"),
  midiMode: $("#midiMode"),
  midiProgression: $("#midiProgression"),
  midiBpm: $("#midiBpm"),
  midiBars: $("#midiBars"),
  soundsStatus: $("#soundsStatus"),
  soundsList: $("#soundsList"),
  settingsModal: $("#settingsModal"),
  settingsButton: $("#settingsButton"),
  closeSettings: $("#closeSettings"),
  apiKeyInput: $("#apiKeyInput"),
  keyHint: $("#keyHint"),
  modelSelect: $("#modelSelect"),
  reasoningSelect: $("#reasoningSelect"),
  saveSettingsButton: $("#saveSettingsButton"),
  removeKeyButton: $("#removeKeyButton"),
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

let currentApproval = null;
let toastTimer;
let beatMetadata = null;
let beatFiles = [];
let selectedBeatPath = "";
let albumLibrary = { items: [], counts: { songs: 0, beats: 0, other: 0 } };
let albumFilter = "songs";
let selectedPlecatBeatPath = "";
let plecatLibraryFilter = "all";
const FAVORITES_STORAGE_KEY = "studio-chat-beat-favorites-v1";
let favoriteBeatIds = loadFavoriteBeatIds();
let playerQueue = [];
let playerIndex = -1;
let sounds = [];
let soundsTab = "vocal";

function openWorkspaceSection(targetId, button) {
  const target = document.getElementById(targetId);
  if (!target) return;
  $$(".workspace-nav-button").forEach((item) => item.classList.toggle("active", item === button));
  $$(".workspace-view").forEach((view) => view.classList.toggle("active-workspace-view", view === target));
  const labels = {
    playerPanel: ["Plecat audio", "Player"],
    presetsPanel: ["Sounds / direct to Logic", "Presets & MIDI"],
    moodboardWorkspace: ["Visual language", "Plecat Moodboard"],
    beatDownloadPanel: ["Collect new sound", "Beat download & inbox"],
  };
  const [eyebrow, title] = labels[targetId] || ["Plecat Mood", "Creative workspace"];
  document.querySelector(".topbar .eyebrow").textContent = eyebrow.toUpperCase();
  document.querySelector(".topbar h2").textContent = title;
  document.querySelector(".main-panel").scrollTo({ top: 0, behavior: "smooth" });
  target.classList.remove("nav-highlight");
  requestAnimationFrame(() => target.classList.add("nav-highlight"));
  window.setTimeout(() => target.classList.remove("nav-highlight"), 1200);
}

const PROJECT_STORAGE_KEY = "studio-chat-plecat-project-v1";
let projectState = loadProjectState();

function loadFavoriteBeatIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function favoriteId(source, filePath) {
  return `${source}:${filePath}`;
}

function isFavorite(source, filePath) {
  return favoriteBeatIds.has(favoriteId(source, filePath));
}

function toggleFavorite(source, file) {
  const id = favoriteId(source, file.path);
  const adding = !favoriteBeatIds.has(id);
  if (adding) favoriteBeatIds.add(id);
  else favoriteBeatIds.delete(id);
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteBeatIds]));
  renderBeatLibrary();
  renderPlecatBeats();
  renderFavorites();
  showToast(adding ? `Added “${file.name.replace(/\.[^.]+$/, "")}” to favorites.` : "Removed from favorites.");
}

function favoriteButton(source, file) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `favorite-toggle${isFavorite(source, file.path) ? " active" : ""}`;
  button.textContent = isFavorite(source, file.path) ? "★" : "☆";
  button.title = isFavorite(source, file.path) ? "Remove from favorites" : "Add to favorites";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(source, file);
  });
  return button;
}

function allFavoriteBeats() {
  const youtube = beatFiles.map((file) => ({ ...file, source: "youtube", sourceLabel: "YouTube downloads" }));
  const plecat = albumLibrary.items
    .filter((item) => item.kind === "audio")
    .map((file) => ({ ...file, source: "plecat", sourceLabel: "Plecat folder" }));
  return [...youtube, ...plecat].filter((file) => isFavorite(file.source, file.path));
}

async function playFavorite(file) {
  playerQueue = allFavoriteBeats();
  playerIndex = Math.max(0, playerQueue.findIndex((item) => favoriteId(item.source, item.path) === favoriteId(file.source, file.path)));
  await playPlayerItem(file);
}

async function playPlayerItem(file) {
  try {
    elements.beatPlayer.pause();
    const previewUrl = file.source === "youtube"
      ? await window.studiochat.getBeatPreviewUrl(file.path)
      : await window.studiochat.getAlbumPreviewUrl(file.path);
    elements.favoriteBeatPlayer.src = previewUrl;
    elements.playerNowTitle.textContent = file.name.replace(/\.[^.]+$/, "");
    elements.playerNowSource.textContent = file.sourceLabel || (file.category === "songs" ? "Plecat song" : "Plecat beat");
    await elements.favoriteBeatPlayer.play();
    elements.favoriteBeatList.querySelectorAll(".playing").forEach((card) => card.classList.remove("playing"));
    elements.favoriteBeatList.querySelector(`[data-favorite-id="${CSS.escape(favoriteId(file.source, file.path))}"]`)?.classList.add("playing");
  } catch (error) { showToast(`Could not play song: ${error.message}`, true); }
}

function formatPlayerTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function playPlayerOffset(offset) {
  if (!playerQueue.length) return;
  playerIndex = (playerIndex + offset + playerQueue.length) % playerQueue.length;
  void playPlayerItem(playerQueue[playerIndex]);
}

function renderFavorites() {
  const favorites = allFavoriteBeats();
  elements.favoriteBeatCount.textContent = `${favorites.length} ${favorites.length === 1 ? "favorite" : "favorites"}`;
  elements.favoriteBeatList.replaceChildren();
  if (!favorites.length) {
    const empty = document.createElement("div");
    empty.className = "favorite-empty";
    empty.innerHTML = "<strong>Your favorites will live here.</strong><span>Press ☆ beside any Plecat song or beat.</span>";
    elements.favoriteBeatList.append(empty);
    return;
  }
  for (const file of favorites) {
    const card = document.createElement("article");
    card.className = "favorite-card";
    card.dataset.favoriteId = favoriteId(file.source, file.path);
    const play = document.createElement("button");
    play.type = "button";
    play.className = "favorite-card-play";
    const icon = document.createElement("span");
    icon.className = "favorite-play-icon";
    icon.textContent = "▶";
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = file.name.replace(/\.[^.]+$/, "");
    const source = document.createElement("span");
    source.textContent = file.sourceLabel;
    copy.append(name, source);
    play.append(icon, copy);
    play.addEventListener("click", () => playFavorite(file));
    card.append(play, favoriteButton(file.source, file));
    elements.favoriteBeatList.append(card);
  }
}

async function loadSounds(message = "Scanning installed Logic presets…") {
  elements.soundsStatus.textContent = message;
  try {
    sounds = await window.studiochat.listSounds();
    elements.soundsStatus.textContent = "Ready. Downloads remain local until you choose Add to Logic.";
    renderSounds();
  } catch (error) {
    elements.soundsStatus.textContent = `Could not load sounds: ${error.message}`;
  }
}

function renderSounds() {
  const query = elements.soundsSearch.value.trim().toLowerCase();
  const matching = sounds.filter((item) => item.type === soundsTab && (!query || item.name.toLowerCase().includes(query)));
  const total = sounds.filter((item) => item.type === soundsTab).length;
  elements.soundsCount.textContent = `${matching.length} of ${total}`;
  elements.soundsList.replaceChildren();
  if (!matching.length) {
    const empty = document.createElement("div");
    empty.className = "sounds-empty";
    empty.textContent = soundsTab === "midi" ? "No MIDI yet. Generate an idea, add a file, or paste a direct download URL." : "No presets found in this category yet.";
    elements.soundsList.append(empty);
    return;
  }
  for (const item of matching) {
    const card = document.createElement("article");
    card.className = "sound-card";
    const icon = document.createElement("span");
    icon.className = "sound-card-icon";
    icon.textContent = item.type === "midi" ? "M" : item.type === "vocal" ? "V" : "I";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    const license = item.metadata?.license || "Local Logic asset";
    meta.textContent = `${item.source} · ${item.extension.toUpperCase().slice(1)} · ${license}`;
    const chain = document.createElement("span");
    const plugins = item.metadata?.plugins || [];
    chain.className = "sound-chain";
    chain.textContent = plugins.length ? `Editable chain: ${plugins.join(" → ")}` : "Editable after loading in Logic";
    copy.append(name, meta, chain);
    const actions = document.createElement("div");
    actions.className = "sound-card-actions";
    const reveal = document.createElement("button");
    reveal.className = "text-button";
    reveal.textContent = "Show file";
    reveal.addEventListener("click", () => window.studiochat.revealSound(item.path));
    const apply = document.createElement("button");
    apply.className = "primary";
    apply.textContent = item.type === "midi" ? "Add MIDI to Logic" : "Load preset in Logic";
    apply.addEventListener("click", async () => {
      apply.disabled = true;
      showActivity(item.type === "midi" ? "Adding MIDI to Logic" : "Loading preset in Logic");
      try {
        const result = item.type === "midi"
          ? await window.studiochat.applyMidi({ filePath: item.path, bar: Number(elements.midiStartBar.value) || 1 })
          : await window.studiochat.applyPreset({ filePath: item.path, type: item.type, track: Math.max(0, (Number(elements.soundsTrack.value) || 1) - 1) });
        showToast(result.text, !result.ok);
      } catch (error) { showToast(error.message, true); }
      finally { apply.disabled = false; hideActivity(); }
    });
    actions.append(reveal, apply);
    card.append(icon, copy, actions);
    elements.soundsList.append(card);
  }
}

function emptyProjectState() {
  return { images: [], songs: [], tracklist: [], lyrics: "", songNames: "", ideas: "", mode: "single", mood: "", sound: "", world: "", updatedAt: new Date().toISOString() };
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

function setCreationMode(mode) {
  projectState.mode = mode;
  const album = mode === "album";
  elements.singleModeButton.classList.toggle("active", !album);
  elements.albumModeButton.classList.toggle("active", album);
  elements.workspaceTitle.textContent = album ? "Shape the album world" : "Build the first single";
  elements.workspaceSubtitle.textContent = album
    ? "Let the chapters, images, and sonic palette find each other."
    : "Collect the feeling before you decide the details.";
  elements.nextFrameTitle.textContent = album ? "Chapter one" : "Cover image";
  saveProjectState();
}

function openProjectBoard() {
  renderProjectBoard();
  void loadAlbumLibrary();
  elements.projectBoardModal.classList.remove("hidden");
}

async function loadAlbumLibrary() {
  try {
    albumLibrary = await window.studiochat.listAlbumLibrary();
    elements.albumSongCount.textContent = albumLibrary.counts.songs;
    elements.albumBeatCount.textContent = albumLibrary.counts.beats;
    elements.albumOtherCount.textContent = albumLibrary.counts.other;
    const total = albumLibrary.items.length;
    elements.albumLibrarySummary.textContent = `${total} files indexed from your Plecat archive · ${albumLibrary.counts.songs} songs · ${albumLibrary.counts.beats} beats · ${albumLibrary.counts.other} other`;
    renderAlbumLibrary();
    renderPlecatBeats();
    renderFavorites();
  } catch (error) {
    elements.albumLibrarySummary.textContent = `Could not read the Plecat archive: ${error.message}`;
  }
}

function renderPlecatBeats() {
  const allAudio = albumLibrary.items.filter((item) => item.kind === "audio");
  const visibleAudio = plecatLibraryFilter === "all"
    ? allAudio
    : allAudio.filter((item) => item.category === plecatLibraryFilter);
  elements.plecatBeatCount.textContent = `${visibleAudio.length} of ${allAudio.length} audio files`;
  elements.plecatBeatList.replaceChildren();
  if (!visibleAudio.length) {
    const empty = document.createElement("p");
    empty.className = "project-empty";
    empty.textContent = `No ${plecatLibraryFilter} found.`;
    elements.plecatBeatList.append(empty);
    return;
  }
  for (const item of visibleAudio) {
    const row = document.createElement("div");
    row.className = "plecat-beat-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `plecat-beat-card${item.path === selectedPlecatBeatPath ? " selected" : ""}`;
    const name = document.createElement("strong");
    name.textContent = item.name.replace(/\.[^.]+$/, "");
    const meta = document.createElement("span");
    meta.textContent = `${item.category === "songs" ? "SONG" : "BEAT"} · ${(item.size / 1024 / 1024).toFixed(1)} MB · ${item.relativePath}`;
    button.append(name, meta);
    button.addEventListener("click", async () => {
      selectedPlecatBeatPath = item.path;
      playerQueue = visibleAudio.map((file) => ({ ...file, source: "plecat", sourceLabel: file.category === "songs" ? "Plecat song" : "Plecat beat" }));
      playerIndex = playerQueue.findIndex((file) => file.path === item.path);
      await playPlayerItem(playerQueue[playerIndex]);
      renderPlecatBeats();
    });
    row.append(button);
    row.append(favoriteButton("plecat", item));
    if (item.category === "songs") row.classList.add("song-row");
    elements.plecatBeatList.append(row);
  }
}

function renderAlbumLibrary() {
  const items = albumLibrary.items.filter((item) => item.category === albumFilter);
  elements.albumLibraryList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "project-empty";
    empty.textContent = `No ${albumFilter} found.`;
    elements.albumLibraryList.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement(item.kind === "audio" ? "button" : "article");
    if (row instanceof HTMLButtonElement) row.type = "button";
    row.className = "album-file-row";
    const icon = document.createElement("span");
    icon.className = "album-file-icon";
    icon.textContent = item.kind === "audio" ? "♫" : item.kind === "project" ? "⌘" : "□";
    const copy = document.createElement("span");
    copy.className = "album-file-copy";
    const title = document.createElement("strong");
    title.textContent = item.name.replace(/\.[^.]+$/, "");
    const meta = document.createElement("span");
    const size = item.size ? ` · ${(item.size / 1024 / 1024).toFixed(1)} MB` : "";
    meta.textContent = `${item.label}${size} · ${item.relativePath}`;
    copy.append(title, meta);
    row.append(icon, copy);
    if (item.kind === "audio") row.addEventListener("click", async () => {
      try {
        elements.albumPlayer.src = await window.studiochat.getAlbumPreviewUrl(item.path);
        await elements.albumPlayer.play();
        elements.albumLibraryList.querySelectorAll(".playing").forEach((element) => element.classList.remove("playing"));
        row.classList.add("playing");
      } catch (error) { showToast(`Could not play ${item.name}: ${error.message}`, true); }
    });
    elements.albumLibraryList.append(row);
  }
}

function closeProjectBoard() {
  elements.projectBoardModal.classList.add("hidden");
}

function setConnection(status) {
  const state = status.state || (status.connected ? "connected" : "idle");
  elements.connectionDot.className = `status-dot ${state}`;
  elements.connectionCard.className = `connection-card ${state}`;
  if (state === "connected") {
    elements.connectionLabel.textContent = "Logic is live";
    elements.connectButton.innerHTML = '<span class="connect-button-icon">✓</span><span>Connected to Logic</span>';
    elements.connectionDetail.textContent = `${status.toolCount || 0} studio tools ready · transport, tracks, mixer, MIDI, project and analysis controls`;
  } else if (state === "connecting") {
    elements.connectionLabel.textContent = "Connecting…";
    elements.connectButton.innerHTML = '<span class="connect-button-icon">◌</span><span>Connecting to Logic…</span>';
    elements.connectionDetail.textContent = "Checking Logic Pro, permissions, MCP tools, and live project access…";
  } else if (state === "error") {
    elements.connectionLabel.textContent = "Connection failed";
    elements.connectButton.innerHTML = '<span class="connect-button-icon">↻</span><span>Try connection again</span>';
    elements.connectionDetail.textContent = status.message || "Open Logic Pro and check Automation and Accessibility permissions.";
  } else {
    elements.connectionLabel.textContent = "Not connected";
    elements.connectButton.innerHTML = '<span class="connect-button-icon">⌁</span><span>Connect to Logic</span>';
    elements.connectionDetail.textContent = "Start Logic Pro, then connect the studio controls.";
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

async function runQuickAction(action, button) {
  const previous = button?.textContent;
  if (button) button.disabled = true;
  showActivity(`Running ${action}`);
  try {
    const result = await window.studiochat.runQuickAction(action);
    if (["audit", "health"].includes(action)) {
      showToast(result.text, !result.ok);
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
    renderFavorites();
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
    const row = document.createElement("div");
    row.className = "beat-card-row";
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
    row.append(card, favoriteButton("youtube", file));
    elements.beatLibrary.append(row);
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
    elements.favoriteBeatPlayer.pause();
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
elements.playerPreviousButton.addEventListener("click", () => playPlayerOffset(-1));
elements.playerNextButton.addEventListener("click", () => playPlayerOffset(1));
elements.playerPlayButton.addEventListener("click", () => {
  if (!elements.favoriteBeatPlayer.src) {
    playerQueue = allFavoriteBeats();
    if (playerQueue.length) { playerIndex = 0; void playPlayerItem(playerQueue[0]); }
    return;
  }
  if (elements.favoriteBeatPlayer.paused) void elements.favoriteBeatPlayer.play();
  else elements.favoriteBeatPlayer.pause();
});
elements.playerStopButton.addEventListener("click", () => {
  elements.favoriteBeatPlayer.pause();
  elements.favoriteBeatPlayer.currentTime = 0;
});
elements.favoriteBeatPlayer.addEventListener("play", () => { elements.playerPlayButton.textContent = "❚❚"; });
elements.favoriteBeatPlayer.addEventListener("pause", () => { elements.playerPlayButton.textContent = "▶"; });
elements.favoriteBeatPlayer.addEventListener("ended", () => playPlayerOffset(1));
elements.favoriteBeatPlayer.addEventListener("loadedmetadata", () => {
  elements.playerDuration.textContent = formatPlayerTime(elements.favoriteBeatPlayer.duration);
});
elements.favoriteBeatPlayer.addEventListener("timeupdate", () => {
  const { currentTime, duration } = elements.favoriteBeatPlayer;
  elements.playerCurrentTime.textContent = formatPlayerTime(currentTime);
  elements.playerSeek.value = Number.isFinite(duration) && duration > 0 ? String((currentTime / duration) * 100) : "0";
});
elements.playerSeek.addEventListener("input", () => {
  const duration = elements.favoriteBeatPlayer.duration;
  if (Number.isFinite(duration)) elements.favoriteBeatPlayer.currentTime = (Number(elements.playerSeek.value) / 100) * duration;
});
elements.singleModeButton.addEventListener("click", () => setCreationMode("single"));
elements.albumModeButton.addEventListener("click", () => setCreationMode("album"));
elements.focusMoodboardButton.addEventListener("click", () => {
  const panel = document.getElementById("moodboardPanel");
  const focused = panel.classList.toggle("focused");
  elements.focusMoodboardButton.textContent = focused ? "Exit focus" : "Focus board";
});
$$("[data-action]").forEach((button) => {
  button.addEventListener("click", () =>
    runQuickAction(button.dataset.action, button)
  );
});

elements.settingsButton.addEventListener("click", openSettings);
elements.projectBoardButton.addEventListener("click", openProjectBoard);
elements.openAlbumFolderButton.addEventListener("click", () => window.studiochat.openAlbumFolder());
elements.openPlecatBeatFolderButton.addEventListener("click", () => window.studiochat.openAlbumFolder());
elements.soundsSearch.addEventListener("input", renderSounds);
$$('.workspace-nav-button').forEach((button) => button.addEventListener("click", () => openWorkspaceSection(button.dataset.workspaceTarget, button)));
$$('[data-sounds-tab]').forEach((button) => button.addEventListener("click", () => {
  soundsTab = button.dataset.soundsTab;
  $$('[data-sounds-tab]').forEach((item) => item.classList.toggle("active", item === button));
  elements.midiGeneratorForm.classList.toggle("hidden", soundsTab !== "midi");
  elements.midiBarLabel.classList.toggle("hidden", soundsTab !== "midi");
  renderSounds();
}));
elements.addLocalSoundButton.addEventListener("click", async () => {
  try {
    await window.studiochat.addLocalSounds(soundsTab);
    await loadSounds("Importing local files…");
  } catch (error) { showToast(error.message, true); }
});
elements.soundDownloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = elements.soundDownloadForm.querySelector("button");
  button.disabled = true;
  elements.soundsStatus.textContent = "Downloading and verifying file…";
  try {
    await window.studiochat.downloadSound({ url: elements.soundUrlInput.value.trim(), type: soundsTab });
    elements.soundUrlInput.value = "";
    await loadSounds("Refreshing Sounds library…");
    showToast("Sound added to the local library.");
  } catch (error) { elements.soundsStatus.textContent = error.message; showToast(error.message, true); }
  finally { button.disabled = false; }
});
elements.midiGeneratorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = elements.midiGeneratorForm.querySelector("button");
  button.disabled = true;
  try {
    await window.studiochat.generateMidi({ root: elements.midiRoot.value, mode: elements.midiMode.value, progression: elements.midiProgression.value, bpm: Number(elements.midiBpm.value), bars: Number(elements.midiBars.value) });
    await loadSounds("Generating MIDI…");
    showToast("MIDI progression generated.");
  } catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});
$$('[data-plecat-filter]').forEach((button) => button.addEventListener("click", () => {
  plecatLibraryFilter = button.dataset.plecatFilter;
  $$('[data-plecat-filter]').forEach((item) => item.classList.toggle("active", item === button));
  renderPlecatBeats();
}));
$$('[data-album-filter]').forEach((button) => button.addEventListener("click", () => {
  albumFilter = button.dataset.albumFilter;
  $$('[data-album-filter]').forEach((item) => item.classList.toggle("active", item === button));
  elements.albumPlayer.pause();
  renderAlbumLibrary();
}));
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
elements.acceptApproval.addEventListener("click", () => answerApproval(true));
elements.declineApproval.addEventListener("click", () => answerApproval(false));

window.studiochat.onStatus(setConnection);
window.studiochat.onActivity(showActivity);
window.studiochat.onApproval(showApproval);

async function bootstrap() {
  const beatDownloadPanel = document.getElementById("beatDownloadPanel");
  beatDownloadPanel.append(document.getElementById("beatDownloadSource"), document.getElementById("beatInboxSource"));
  document.getElementById("playerPanel").append(document.getElementById("plecatLibraryPanel"));
  const state = await window.studiochat.getBootstrap();
  elements.versionLabel.textContent = `studio-chat MVP · ${state.version}`;
  elements.mcpVersionLabel.textContent = `LogicProMCP ${state.logicMcpVersion}`;
  setConnection(state.logic);
  setCreationMode(projectState.mode || "single");
  renderFavorites();
  void loadAlbumLibrary();
  void loadBeatInbox();
  void loadSounds();
  const initialNavigation = document.querySelector('[data-workspace-target="playerPanel"]');
  openWorkspaceSection("playerPanel", initialNavigation);
}

void bootstrap();
