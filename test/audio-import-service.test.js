import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { audioContainerFromHeader, ensurePlayablePreview } from "../src/audio-import-service.js";

test("recognizes AIFF audio even when a filename has the wrong extension", () => {
  assert.equal(audioContainerFromHeader(Buffer.from("FORM0000AIFF", "ascii")), "aiff");
  assert.equal(audioContainerFromHeader(Buffer.from("FORM0000AIFC", "ascii")), "aiff");
});

test("recognizes common playable audio headers", () => {
  assert.equal(audioContainerFromHeader(Buffer.from("RIFF0000WAVE", "ascii")), "wav");
  assert.equal(audioContainerFromHeader(Buffer.from("ID3.........", "ascii")), "mp3");
});

test("copies Plecat audio into a stable local playback cache", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-chat-preview-test-"));
  const source = path.join(root, "cloud-beat.mp3");
  await fs.writeFile(source, Buffer.from("ID3 playable test audio", "ascii"));
  const preview = await ensurePlayablePreview(source, { cacheSource: true });
  assert.notEqual(preview, source);
  assert.deepEqual(await fs.readFile(preview), await fs.readFile(source));
});
