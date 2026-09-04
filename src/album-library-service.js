import fs from "node:fs/promises";
import path from "node:path";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".aif", ".aiff", ".m4a"]);
const PROJECT_EXTENSIONS = new Set([".flp", ".logicx"]);
const BEAT_NAME = /(?:^|[^a-z0-9])(type[ -]?beat|instrumental|karaoke|soundtrack|score|remix|prod\.?|free for profit|free|beatshoven|bpm\d*)(?=[^a-z0-9]|$)/i;

export class AlbumLibraryService {
  constructor(sourceDirectory) {
    this.sourceDirectory = sourceDirectory;
  }

  async inventory() {
    const root = await fs.realpath(this.sourceDirectory);
    const files = await this.#walk(root);
    const items = files
      .filter((item) => item.name !== ".DS_Store")
      .map((item) => this.#describe(root, item))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return {
      album: "Plecat",
      source: root,
      items,
      counts: items.reduce((counts, item) => {
        counts[item.category] += 1;
        return counts;
      }, { songs: 0, beats: 0, other: 0 })
    };
  }

  async permittedAudioPath(candidatePath) {
    const inventory = await this.inventory();
    const match = inventory.items.find((item) => item.path === candidatePath && item.kind === "audio");
    if (!match) throw new Error("That file is not part of the Plecat audio library.");
    return match.path;
  }

  async #walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const itemPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        // Logic projects are bundles: treat them as one useful project file.
        if (path.extname(entry.name).toLowerCase() === ".logicx") return [{ name: entry.name, path: itemPath, directory: true, size: 0 }];
        return this.#walk(itemPath);
      }
      if (!entry.isFile()) return [];
      const stats = await fs.stat(itemPath);
      return [{ name: entry.name, path: itemPath, directory: false, size: stats.size }];
    }));
    return nested.flat();
  }

  #describe(root, item) {
    const relativePath = path.relative(root, item.path);
    const extension = path.extname(item.name).toLowerCase();
    const kind = AUDIO_EXTENSIONS.has(extension) ? "audio" : PROJECT_EXTENSIONS.has(extension) ? "project" : "document";
    let category = "other";
    let label = kind === "project" ? "Production project" : "Document";
    if (kind === "audio") {
      const inBeatFolder = relativePath.split(path.sep).some((part) => part.toLowerCase() === "beats");
      category = inBeatFolder || BEAT_NAME.test(path.basename(item.name, extension)) ? "beats" : "songs";
      label = category === "beats" ? (inBeatFolder ? "Beat archive" : "Beat / reference") : "Song / recording";
    } else if ([".jpg", ".jpeg", ".png", ".heic"].includes(extension)) label = "Image";
    else if ([".pdf", ".doc", ".docx"].includes(extension)) label = "Document";
    return { ...item, relativePath, extension, kind, category, label };
  }
}

export const albumLibraryInternals = { AUDIO_EXTENSIONS, BEAT_NAME };
