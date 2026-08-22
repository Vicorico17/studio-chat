import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const YTDLP_BINARY = "/opt/homebrew/bin/yt-dlp";
const YTDLP_YOUTUBE_ARGS = ["--no-playlist", "--remote-components", "ejs:npm"];

function firstJsonLine(stdout) {
  const line = stdout.split("\n").find((value) => value.trim().startsWith("{"));
  if (!line) throw new Error("The link did not return any media information.");
  return JSON.parse(line);
}

function safeFilename(title) {
  return title.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 100) || "untitled-beat";
}

export class BeatDownloadService {
  constructor(downloadDirectory) {
    this.downloadDirectory = downloadDirectory;
  }

  async inspect(url) {
    const sourceUrl = this.#sourceUrl(url);
    const { stdout } = await execFileAsync(YTDLP_BINARY, [...YTDLP_YOUTUBE_ARGS, "-j", sourceUrl], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024
    });
    const info = firstJsonLine(stdout);
    return {
      title: info.title || "Untitled beat",
      uploader: info.uploader || "",
      duration: info.duration || null,
      thumbnail: info.thumbnail || ""
    };
  }

  async download(url, title = "") {
    const sourceUrl = this.#sourceUrl(url);
    await fs.mkdir(this.downloadDirectory, { recursive: true });
    const media = title ? { title } : await this.inspect(sourceUrl);
    const baseName = safeFilename(title || media.title);
    const output = path.join(this.downloadDirectory, `${baseName}.%(ext)s`);
    await execFileAsync(
      YTDLP_BINARY,
      [
        ...YTDLP_YOUTUBE_ARGS, "--no-overwrites", "-f", "140/139/bestaudio", "-o", output,
        "-x", "--audio-format", "mp3",
        "--write-thumbnail", "--convert-thumbnails", "jpg", sourceUrl
      ],
      { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 }
    );
    const mp3Path = path.join(this.downloadDirectory, `${baseName}.mp3`);
    try {
      await fs.access(mp3Path);
    } catch {
      throw new Error("The download finished without creating an MP3 file.");
    }
    return { ...media, name: path.basename(mp3Path), path: mp3Path };
  }

  #sourceUrl(url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error("Paste a valid YouTube link."); }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Paste an http or https link.");
    }
    const host = parsed.hostname.replace(/^www\./, "");
    const videoId = host === "youtube.com" && parsed.pathname === "/watch"
      ? parsed.searchParams.get("v")
      : host === "youtu.be"
        ? parsed.pathname.slice(1)
        : null;
    return videoId
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
      : parsed.href;
  }
}
