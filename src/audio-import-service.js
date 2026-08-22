import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".aif", ".aiff", ".m4a"]);

export class AudioImportService {
  constructor(downloadDirectory) {
    this.downloadDirectory = downloadDirectory;
  }

  async listFiles() {
    const entries = await fs.readdir(this.downloadDirectory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(async (entry) => {
          const filePath = path.join(this.downloadDirectory, entry.name);
          const stats = await fs.stat(filePath);
          const coverPath = path.join(
            this.downloadDirectory,
            `${path.basename(entry.name, path.extname(entry.name))}.jpg`
          );
          let coverPathOrNull = null;
          try {
            await fs.access(coverPath);
            coverPathOrNull = coverPath;
          } catch {
            // Artwork is optional.
          }
          return { name: entry.name, path: filePath, coverPath: coverPathOrNull, size: stats.size, modifiedAt: stats.mtimeMs };
        })
    );
    return files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  async importIntoLogic(filePath) {
    const permittedPath = await this.#assertPermittedAudioFile(filePath);
    const script = `
on run argv
  set audioPath to item 1 of argv
  tell application "Logic Pro" to activate
  delay 1
  tell application "System Events"
    tell process "Logic Pro"
      set frontmost to true
      -- Logic Pro's Import Audio File shortcut avoids relying on File-menu labels.
      keystroke "i" using {command down, shift down}
      delay 1
      keystroke "g" using {command down, shift down}
      delay 0.75
      keystroke audioPath
      key code 36
      delay 1
      key code 36
    end tell
  end tell
end run`;

    await execFileAsync("/usr/bin/osascript", ["-e", script, permittedPath], {
      timeout: 20_000
    });
    return {
      ok: true,
      text: "Sent the beat to Logic's selected audio track at the playhead position."
    };
  }

  async #assertPermittedAudioFile(filePath) {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
      throw new Error("Choose an audio file from the local Beat Inbox.");
    }
    const [root, candidate] = await Promise.all([
      fs.realpath(this.downloadDirectory),
      fs.realpath(filePath)
    ]);
    if (!candidate.startsWith(`${root}${path.sep}`) || !AUDIO_EXTENSIONS.has(path.extname(candidate).toLowerCase())) {
      throw new Error("Only audio files in the local Beat Inbox can be imported.");
    }
    return candidate;
  }
}
