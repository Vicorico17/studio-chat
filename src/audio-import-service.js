import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".aif", ".aiff", ".m4a"]);
const previewJobs = new Map();

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

  async playablePreviewPath(filePath) {
    const permittedPath = await this.#assertPermittedAudioFile(filePath);
    return ensurePlayablePreview(permittedPath);
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

export async function ensurePlayablePreview(permittedPath, { cacheSource = false } = {}) {
  const jobKey = `${permittedPath}:${cacheSource}`;
  if (previewJobs.has(jobKey)) return previewJobs.get(jobKey);
  const job = createPlayablePreview(permittedPath, { cacheSource })
    .catch((error) => {
      if (error.code === "ETIMEDOUT" || /timed out/i.test(error.message)) {
        throw new Error("This file is not fully available on this Mac. In Finder, choose Download Now for it, then press play again.");
      }
      throw error;
    })
    .finally(() => previewJobs.delete(jobKey));
  previewJobs.set(jobKey, job);
  return job;
}

async function createPlayablePreview(permittedPath, { cacheSource }) {
    const stats = await withFileTimeout(fs.stat(permittedPath), "Reading audio information");
    const handle = await withFileTimeout(fs.open(permittedPath, "r"), "Opening audio preview");
    const header = Buffer.alloc(12);
    try {
      await withFileTimeout(handle.read(header, 0, header.length, 0), "Reading audio preview");
    } finally {
      await handle.close();
    }
    const container = audioContainerFromHeader(header);

    // Chromium can stop early or report the wrong duration for some downloaded
    // MP3s, and a few old lossless exports have an .mp3 suffix despite being
    // AIFF. Normalize both into a disposable WAV preview while preserving the
    // original file for Logic and archival use.
    const cacheKey = crypto
      .createHash("sha256")
      .update(`${permittedPath}:${stats.size}:${stats.mtimeMs}`)
      .digest("hex")
      .slice(0, 20);
    const cacheDirectory = path.join(os.tmpdir(), "studio-chat-audio-previews");
    const needsConversion = container === "aiff" || container === "mp3";
    const sourceLink = path.join(cacheDirectory, `${cacheKey}${container === "aiff" ? ".aiff" : ".mp3"}`);
    const outputExtension = needsConversion ? ".wav" : path.extname(permittedPath).toLowerCase();
    const previewPath = path.join(cacheDirectory, `${cacheKey}${outputExtension}`);
    await fs.mkdir(cacheDirectory, { recursive: true });
    try {
      await fs.access(previewPath);
      return previewPath;
    } catch {
      // Cache miss: conversion happens once per source version.
    }
    if (!needsConversion) {
      if (!cacheSource) return permittedPath;
      const temporaryPreview = `${previewPath}.part-${crypto.randomUUID()}`;
      try {
        await withFileTimeout(fs.copyFile(permittedPath, temporaryPreview), "Preparing local audio preview", 45_000);
        await fs.rename(temporaryPreview, previewPath);
      } catch (error) {
        await fs.rm(temporaryPreview, { force: true });
        throw error;
      }
      return previewPath;
    }
    try {
      await fs.symlink(permittedPath, sourceLink);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    await execFileAsync("/usr/bin/afconvert", [sourceLink, previewPath, "-f", "WAVE", "-d", "LEI16"], {
      timeout: 60_000
    });
    return previewPath;
}

function withFileTimeout(promise, label, timeoutMs = 15_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.code = "ETIMEDOUT";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function audioContainerFromHeader(header) {
  if (!Buffer.isBuffer(header) || header.length < 12) return "unknown";
  if (header.toString("ascii", 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(header.toString("ascii", 8, 12))) return "aiff";
  if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WAVE") return "wav";
  if (header.toString("ascii", 0, 3) === "ID3" || header[0] === 0xff) return "mp3";
  return "unknown";
}
