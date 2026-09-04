import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SoundLibraryService } from "../src/sound-library-service.js";

test("discovers installed vocal presets and generated MIDI", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-chat-sounds-"));
  const music = path.join(root, "Music");
  const presetDirectory = path.join(music, "Audio Music Apps", "Channel Strip Settings", "Track", "Vocals");
  await fs.mkdir(presetDirectory, { recursive: true });
  await fs.writeFile(path.join(presetDirectory, "Airy.cst"), "preset");
  const service = new SoundLibraryService({ storageDirectory: path.join(root, "managed"), userMusicDirectory: music });

  const generated = await service.generateMidi({ root: "C", mode: "minor", progression: "1,6,3,7", bpm: 90, bars: 4 });
  const items = await service.list();
  assert.equal(items.filter((item) => item.type === "vocal").length, 1);
  assert.equal(items.filter((item) => item.type === "midi").length, 1);
  const sequence = await service.midiSequence(generated.path);
  assert.equal(sequence.noteCount, 12);
  assert.equal(sequence.tempo, 90);
});

test("rejects unsupported local files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-chat-sounds-"));
  const badFile = path.join(root, "installer.command");
  await fs.writeFile(badFile, "unsafe");
  const service = new SoundLibraryService({ storageDirectory: path.join(root, "managed"), userMusicDirectory: path.join(root, "Music") });
  await assert.rejects(() => service.importLocal([badFile], "vocal"), /not a supported/);
});
