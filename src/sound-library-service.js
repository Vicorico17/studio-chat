import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import midiFilePackage from "midi-file";

const { parseMidi, writeMidi } = midiFilePackage;
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED = {
  midi: new Set([".mid", ".midi"]),
  vocal: new Set([".cst", ".patch", ".pst"]),
  instrument: new Set([".cst", ".patch", ".pst"])
};
const NOTE_NAMES = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const LOGIC_EFFECT_NAMES = [
  "Pitch Correction", "PitchCor", "Noise Gate", "Channel EQ", "Console EQ", "Linear Phase EQ", "Vintage Tube EQ",
  "Vintage Console EQ", "Vintage Graphic EQ", "Compressor", "DeEsser 2", "DeEsser", "Exciter", "ChromaGlow",
  "Phat FX", "Step FX", "Overdrive", "Distortion", "Vocal Transformer", "Multipressor", "Enveloper",
  "Space Designer", "ChromaVerb", "SilverVerb", "Tape Delay", "Stereo Delay", "Delay Designer", "Echo", "Gain", "Limiter", "Adaptive Limiter"
];

export class SoundLibraryService {
  constructor({ storageDirectory, userMusicDirectory, logicFactoryVocalDirectory = "/Applications/Logic Pro.app/Contents/Resources/Patches/Audio/04 Voice" }) {
    this.storageDirectory = storageDirectory;
    this.userMusicDirectory = userMusicDirectory;
    this.vocalPresetDirectory = path.join(userMusicDirectory, "Audio Music Apps", "Channel Strip Settings", "Track");
    this.logicFactoryVocalDirectory = logicFactoryVocalDirectory;
  }

  async list() {
    await this.#initialize();
    const [managedMidi, managedVocal, managedInstrument, installedVocal, factoryVocal] = await Promise.all([
      this.#scan(path.join(this.storageDirectory, "midi"), "midi", "Downloaded / generated"),
      this.#scan(path.join(this.storageDirectory, "vocal"), "vocal", "Downloaded"),
      this.#scan(path.join(this.storageDirectory, "instrument"), "instrument", "Downloaded"),
      this.#scan(this.vocalPresetDirectory, "vocal", "Installed in Logic", true),
      this.#scanFactoryVocalPatches()
    ]);
    return [...installedVocal, ...factoryVocal, ...managedVocal, ...managedInstrument, ...managedMidi];
  }

  async download({ url, type, license = "Review source license" }) {
    if (!ALLOWED[type]) throw new Error("Choose MIDI, Vocal preset, or Instrument preset.");
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Downloads must use HTTPS.");
    const filename = safeFilename(decodeURIComponent(path.basename(parsed.pathname)));
    const extension = path.extname(filename).toLowerCase();
    if (!ALLOWED[type].has(extension)) throw new Error(`Expected one of: ${[...ALLOWED[type]].join(", ")}. ZIP packs are not accepted yet; use the individual preset or MIDI file.`);
    await this.#initialize();
    const response = await fetch(parsed, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
    if (!response.ok || !response.body) throw new Error(`Download failed with HTTP ${response.status}.`);
    if (new URL(response.url).protocol !== "https:") throw new Error("The download redirected to an insecure URL.");
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_DOWNLOAD_BYTES) throw new Error("File is larger than the 100 MB safety limit.");
    const destination = path.join(this.storageDirectory, type, filename);
    const temporary = `${destination}.part-${crypto.randomUUID()}`;
    let received = 0;
    const limiter = new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_DOWNLOAD_BYTES) throw new Error("File exceeded the 100 MB safety limit.");
        controller.enqueue(chunk);
      }
    });
    try {
      await pipeline(Readable.fromWeb(response.body.pipeThrough(limiter)), createWriteStream(temporary, { flags: "wx" }));
      await fs.rename(temporary, destination);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    const digest = crypto.createHash("sha256").update(await fs.readFile(destination)).digest("hex");
    const licenseLabel = String(license).trim().slice(0, 120) || "Review source license";
    const metadata = { sourceUrl: parsed.href, license: licenseLabel, sha256: digest, downloadedAt: new Date().toISOString() };
    await fs.writeFile(`${destination}.json`, JSON.stringify(metadata, null, 2));
    return this.#describe(destination, type, "Downloaded", metadata);
  }

  async importLocal(filePaths, type) {
    if (!ALLOWED[type]) throw new Error("Choose a supported sound-library type.");
    await this.#initialize();
    const imported = [];
    for (const source of filePaths) {
      const extension = path.extname(source).toLowerCase();
      if (!ALLOWED[type].has(extension)) throw new Error(`“${path.basename(source)}” is not a supported ${type} file.`);
      const destination = await uniquePath(path.join(this.storageDirectory, type, safeFilename(path.basename(source))));
      await fs.copyFile(source, destination);
      const metadata = { sourceUrl: source, license: "User supplied", importedAt: new Date().toISOString() };
      await fs.writeFile(`${destination}.json`, JSON.stringify(metadata, null, 2));
      imported.push(await this.#describe(destination, type, "Imported", metadata));
    }
    return imported;
  }

  async generateMidi({ root = "C", mode = "minor", progression = "1,6,3,7", bpm = 90, bars = 4 }) {
    if (!(root in NOTE_NAMES) || !(mode in SCALES)) throw new Error("Choose a supported key and mode.");
    const degrees = String(progression).split(/[ ,.-]+/).filter(Boolean).map(Number);
    if (!degrees.length || degrees.some((degree) => degree < 1 || degree > 7)) throw new Error("Use scale degrees from 1 to 7, such as 1,6,3,7.");
    const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 90));
    const safeBars = Math.max(1, Math.min(16, Number(bars) || 4));
    const ticksPerBeat = 480;
    const beatsPerChord = Math.max(1, Math.floor((safeBars * 4) / degrees.length));
    const scale = SCALES[mode];
    const base = 48 + NOTE_NAMES[root];
    const events = [{ deltaTime: 0, type: "setTempo", microsecondsPerBeat: Math.round(60_000_000 / safeBpm) }];
    for (const degree of degrees) {
      const index = degree - 1;
      const chord = [base + scale[index], base + scale[(index + 2) % 7] + (index + 2 >= 7 ? 12 : 0), base + scale[(index + 4) % 7] + (index + 4 >= 7 ? 12 : 0)];
      chord.forEach((note, noteIndex) => events.push({ deltaTime: noteIndex ? 0 : 0, type: "noteOn", channel: 0, noteNumber: note, velocity: 88 }));
      chord.forEach((note, noteIndex) => events.push({ deltaTime: noteIndex ? 0 : beatsPerChord * ticksPerBeat, type: "noteOff", channel: 0, noteNumber: note, velocity: 0 }));
    }
    events.push({ deltaTime: 0, type: "endOfTrack" });
    await this.#initialize();
    const filename = safeFilename(`${root}-${mode}-${degrees.join("")}-${safeBpm}bpm.mid`);
    const destination = await uniquePath(path.join(this.storageDirectory, "midi", filename));
    await fs.writeFile(destination, Buffer.from(writeMidi({ header: { format: 0, numTracks: 1, ticksPerBeat }, tracks: [events] })));
    const metadata = { sourceUrl: "Generated locally", license: "User-generated", generatedAt: new Date().toISOString(), bpm: safeBpm, key: `${root} ${mode}` };
    await fs.writeFile(`${destination}.json`, JSON.stringify(metadata, null, 2));
    return this.#describe(destination, "midi", "Generated", metadata);
  }

  async midiSequence(filePath) {
    const permitted = await this.#permittedManagedFile(filePath, "midi");
    const parsed = parseMidi(await fs.readFile(permitted));
    const ticksPerBeat = parsed.header.ticksPerBeat || 480;
    let microsecondsPerBeat = 500_000;
    const notes = [];
    for (const track of parsed.tracks) {
      let tick = 0;
      const active = new Map();
      for (const event of track) {
        tick += event.deltaTime || 0;
        if (event.type === "setTempo") microsecondsPerBeat = event.microsecondsPerBeat;
        const key = `${event.channel}:${event.noteNumber}`;
        if (event.type === "noteOn" && event.velocity > 0) active.set(key, { tick, velocity: event.velocity, channel: event.channel });
        if (event.type === "noteOff" || (event.type === "noteOn" && event.velocity === 0)) {
          const start = active.get(key);
          if (!start) continue;
          const msPerTick = microsecondsPerBeat / 1000 / ticksPerBeat;
          notes.push(`${event.noteNumber},${Math.round(start.tick * msPerTick)},${Math.max(1, Math.round((tick - start.tick) * msPerTick))},${start.velocity},${start.channel + 1}`);
          active.delete(key);
        }
      }
    }
    if (!notes.length) throw new Error("This MIDI file contains no importable note events.");
    if (notes.length > 256) throw new Error("This MIDI contains more than 256 notes; choose a smaller clip for direct import.");
    return { notes: notes.join(";"), tempo: Math.round(60_000_000 / microsecondsPerBeat), noteCount: notes.length };
  }

  async preparePreset(filePath, type) {
    if (!ALLOWED[type] || type === "midi") throw new Error("Choose a vocal or instrument preset.");
    const items = await this.list();
    const item = items.find((candidate) => candidate.path === filePath && candidate.type === type);
    if (!item) throw new Error("That preset is no longer in the Sounds library.");
    if (![".cst", ".patch"].includes(item.extension)) throw new Error("Direct loading currently supports Logic channel-strip .cst presets and factory audio patches.");
    await fs.mkdir(this.vocalPresetDirectory, { recursive: true });
    if (item.extension === ".patch") {
      const embeddedPreset = path.join(item.path, "#Root.cst");
      await fs.access(embeddedPreset);
      const installDirectory = path.join(this.vocalPresetDirectory, "studio-chat", "Logic Factory Vocals");
      await fs.mkdir(installDirectory, { recursive: true });
      const destination = path.join(installDirectory, `${safeFilename(item.name)}.cst`);
      await fs.copyFile(embeddedPreset, destination);
      return { path: destination, presetName: item.name, folderNames: ["studio-chat", "Logic Factory Vocals"] };
    }
    const root = await fs.realpath(this.vocalPresetDirectory);
    const candidate = await fs.realpath(item.path);
    if (candidate.startsWith(`${root}${path.sep}`)) {
      const parts = path.relative(root, candidate).split(path.sep);
      return { path: candidate, presetName: path.basename(candidate, ".cst"), folderNames: parts.slice(0, -1).slice(-2) };
    }
    const installDirectory = path.join(this.vocalPresetDirectory, "studio-chat", type === "vocal" ? "Vocal Presets" : "Instrument Presets");
    await fs.mkdir(installDirectory, { recursive: true });
    const destination = path.join(installDirectory, path.basename(candidate));
    await fs.copyFile(candidate, destination);
    return { path: destination, presetName: path.basename(destination, ".cst"), folderNames: ["studio-chat", type === "vocal" ? "Vocal Presets" : "Instrument Presets"] };
  }

  async #initialize() {
    await Promise.all(Object.keys(ALLOWED).map((type) => fs.mkdir(path.join(this.storageDirectory, type), { recursive: true })));
  }

  async #scan(directory, type, source, tolerateMissing = false) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (tolerateMissing && error.code === "ENOENT") return []; throw error; }
    const results = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return this.#scan(entryPath, type, source, tolerateMissing);
      if (!entry.isFile() || !ALLOWED[type].has(path.extname(entry.name).toLowerCase())) return [];
      let metadata = {};
      try { metadata = JSON.parse(await fs.readFile(`${entryPath}.json`, "utf8")); } catch { /* optional sidecar */ }
      return [await this.#describe(entryPath, type, source, metadata)];
    }));
    return results.flat();
  }

  async #scanFactoryVocalPatches() {
    let entries;
    try { entries = await fs.readdir(this.logicFactoryVocalDirectory, { withFileTypes: true, recursive: true }); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const patches = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || path.extname(entry.name).toLowerCase() !== ".patch") continue;
      const parentPath = entry.parentPath || entry.path;
      const patchPath = path.join(parentPath, entry.name);
      try {
        await fs.access(path.join(patchPath, "#Root.cst"));
        patches.push(await this.#describe(patchPath, "vocal", "Logic factory vocals", { license: "Included with Logic Pro" }));
      } catch { /* skip incomplete patch bundles */ }
    }
    return patches;
  }

  async #describe(filePath, type, source, metadata = {}) {
    const stats = await fs.stat(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const presetPath = extension === ".patch" ? path.join(filePath, "#Root.cst") : filePath;
    let plugins = [];
    if (type === "vocal" && [".cst", ".patch"].includes(extension)) {
      try { plugins = detectLogicEffects(await fs.readFile(presetPath)); } catch { /* chain inspection is optional */ }
    }
    return {
      id: crypto.createHash("sha1").update(filePath).digest("hex"),
      name: path.basename(filePath, extension),
      path: filePath,
      extension,
      type,
      source,
      size: stats.size,
      metadata: { ...metadata, plugins }
    };
  }

  async #permittedManagedFile(filePath, type) {
    const [root, candidate] = await Promise.all([fs.realpath(path.join(this.storageDirectory, type)), fs.realpath(filePath)]);
    if (!candidate.startsWith(`${root}${path.sep}`) || !ALLOWED[type].has(path.extname(candidate).toLowerCase())) throw new Error("Choose a file from the managed Sounds library.");
    return candidate;
  }
}

function detectLogicEffects(buffer) {
  const content = buffer.toString("latin1");
  const found = LOGIC_EFFECT_NAMES.filter((name) => content.includes(name) && !(name === "DeEsser" && content.includes("DeEsser 2")));
  if (found.includes("PitchCor") && !found.includes("Pitch Correction")) found[found.indexOf("PitchCor")] = "Pitch Correction";
  return [...new Set(found.filter((name) => name !== "PitchCor"))];
}

function safeFilename(value) {
  const cleaned = value.normalize("NFKC").replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/^\.+/, "").trim();
  if (!cleaned || cleaned.length > 180) throw new Error("The asset filename is invalid or too long.");
  return cleaned;
}

async function uniquePath(candidate) {
  const extension = path.extname(candidate);
  const base = candidate.slice(0, -extension.length);
  for (let index = 0; index < 1000; index += 1) {
    const value = index ? `${base}-${index}${extension}` : candidate;
    try { await fs.access(value); } catch { return value; }
  }
  throw new Error("Could not create a unique filename.");
}
