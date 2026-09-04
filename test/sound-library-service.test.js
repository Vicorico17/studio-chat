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
  const service = new SoundLibraryService({ storageDirectory: path.join(root, "managed"), userMusicDirectory: music, logicFactoryVocalDirectory: path.join(root, "missing-factory-library") });

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
  const service = new SoundLibraryService({ storageDirectory: path.join(root, "managed"), userMusicDirectory: path.join(root, "Music"), logicFactoryVocalDirectory: path.join(root, "missing-factory-library") });
  await assert.rejects(() => service.importLocal([badFile], "vocal"), /not a supported/);
});

test("discovers and prepares Logic factory vocal patches", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-chat-factory-vocals-"));
  const music = path.join(root, "Music");
  const factory = path.join(root, "Logic", "04 Voice");
  const patch = path.join(factory, "Warm Vocal.patch");
  await fs.mkdir(patch, { recursive: true });
  await fs.writeFile(path.join(patch, "#Root.cst"), "factory preset Channel EQ Compressor DeEsser 2 ChromaVerb");
  const service = new SoundLibraryService({
    storageDirectory: path.join(root, "managed"),
    userMusicDirectory: music,
    logicFactoryVocalDirectory: factory
  });

  const item = (await service.list()).find((candidate) => candidate.name === "Warm Vocal");
  assert.equal(item.source, "Logic factory vocals");
  assert.deepEqual(item.metadata.plugins, ["Channel EQ", "Compressor", "DeEsser 2", "ChromaVerb"]);
  const prepared = await service.preparePreset(item.path, "vocal");
  assert.equal(prepared.presetName, "Warm Vocal");
  assert.deepEqual(prepared.folderNames, ["studio-chat", "Logic Factory Vocals"]);
  assert.equal(await fs.readFile(prepared.path, "utf8"), "factory preset Channel EQ Compressor DeEsser 2 ChromaVerb");
});
