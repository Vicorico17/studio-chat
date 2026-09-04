import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AlbumLibraryService } from "../src/album-library-service.js";

test("sorts Plecat material into songs, beats, and other files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plecat-library-"));
  await fs.mkdir(path.join(root, "beats"));
  await fs.writeFile(path.join(root, "vreau doar sa.mp3"), "song");
  await fs.writeFile(path.join(root, "The Weeknd Type Beat.mp3"), "beat");
  await fs.writeFile(path.join(root, "forgiveness-type-beat_6158156.mp3"), "beat");
  await fs.writeFile(path.join(root, "beats", "quiet idea.wav"), "beat");
  await fs.writeFile(path.join(root, "notes.pdf"), "notes");
  await fs.writeFile(path.join(root, ".DS_Store"), "ignored");

  const result = await new AlbumLibraryService(root).inventory();
  assert.deepEqual(result.counts, { songs: 1, beats: 3, other: 1 });
  assert.equal(result.items.find((item) => item.name === "vreau doar sa.mp3").category, "songs");
  assert.equal(result.items.find((item) => item.name === "quiet idea.wav").category, "beats");
});
