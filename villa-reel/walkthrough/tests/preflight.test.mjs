import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { preflight, probeTrack, localMedia, readProps, projectRoot } from "../tools/preflight.mjs";

let work;
let publicDir;
const props = () => ({
  orientation: "horizontal", mode: "draft", title: "Synthetic test", introSec: 0, endCardSec: 0,
  showRoomLabels: true, showCaptions: false,
  rights: { ownerApproval: false, imageRightsCleared: false, privacyChecked: false },
  rooms: [{ id: "room", name: "Room", method: "recorded", durationSec: 1,
    source: { src: "walkthrough/video.mp4", projection: "flat" }, verification: "pending" }],
});
before(() => {
  work = mkdtempSync(path.join(tmpdir(), "walkthrough-tests-"));
  publicDir = path.join(work, "public");
  mkdirSync(path.join(publicDir, "walkthrough"), { recursive: true });
  // Video is 2 seconds, audio 4 seconds: container duration must not mask overruns.
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=160x90:r=30:d=2",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", path.join(publicDir, "walkthrough/video.mp4")]);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    path.join(publicDir, "walkthrough/voice.wav")]);
  execFileSync("ffmpeg", ["-v", "error", "-i", path.join(publicDir, "walkthrough/video.mp4"),
    "-an", "-c:v", "copy", path.join(publicDir, "walkthrough/video.mov")]);
  execFileSync("ffmpeg", ["-v", "error", "-i", path.join(publicDir, "walkthrough/video.mp4"),
    "-an", "-c:v", "libvpx-vp9", "-b:v", "100k", path.join(publicDir, "walkthrough/video.webm")]);
});
after(() => { if (work) rmSync(work, { recursive: true, force: true }); });

test("preflight accepts an existing sufficient video", () => {
  const result = preflight(props(), { publicDir });
  assert.equal(result[0].width, 160);
  assert.equal(result[0].codec, "h264");
  assert.equal(result[0].durationSec, 2);
});
test("preflight uses video track duration even with longer container audio", () => {
  const p = props();p.rooms[0].durationSec = 3;
  assert.throws(() => preflight(p, { publicDir }), /benötigt 3.000s Quelle, vorhanden 2.000s/);
});
test("MOV and WebM have usable video metadata without container-duration guesses", () => {
  for (const ext of ["mov", "webm"]) {
    const p = props();p.rooms[0].source.src = `walkthrough/video.${ext}`;
    const result = preflight(p, { publicDir });
    assert.equal(result[0].durationSec, 2);
    assert.equal(result[0].width, 160);
  }
});
test("preflight includes trim and playback rate and tolerates one rounded frame", () => {
  const p = props();p.rooms[0].trimStartSec = 0.5;p.rooms[0].playbackRate = 2;
  assert.throws(() => preflight(p, { publicDir }), /benötigt 2.500s/);
  p.rooms[0].trimStartSec = 0;p.rooms[0].playbackRate = 1;p.rooms[0].durationSec = 2.02;
  assert.doesNotThrow(() => preflight(p, { publicDir }));
});
test("preflight blocks missing, corrupt, and wrong-track sources", () => {
  const p = props();p.rooms[0].source.src = "walkthrough/missing.mp4";
  assert.throws(() => preflight(p, { publicDir }), /ENOENT/);
  writeFileSync(path.join(publicDir, "walkthrough/broken.mp4"), "not video");
  p.rooms[0].source.src = "walkthrough/broken.mp4";
  assert.throws(() => preflight(p, { publicDir }));
  assert.throws(() => probeTrack(path.join(publicDir, "walkthrough/voice.wav"), "video"), /keine video-Spur/);
});
test("voiceover cannot silently extend beyond its scene; short music can loop", () => {
  const p = props();p.rooms[0].voiceover = { text: "test", audioSrc: "walkthrough/voice.wav" };
  assert.throws(() => preflight(p, { publicDir }), /Sprecheraufnahme/);
  delete p.rooms[0].voiceover;
  p.music = { src: "walkthrough/voice.wav", volume: 0.2 };
  assert.doesNotThrow(() => preflight(p, { publicDir }));
});
test("media symlinks cannot escape the allowed public folders", () => {
  const external = path.join(work, "outside.mp4");writeFileSync(external, "external");
  symlinkSync(external, path.join(publicDir, "walkthrough/link.mp4"));
  assert.throws(() => localMedia(publicDir, "walkthrough/link.mp4"), /freigegebenen Medienordner/);
});
test("readProps rejects invalid JSON shape and final with no rooms", () => {
  const file = path.join(work, "props.json");
  for (const value of [null, [], { ...props(), mode: "final", rooms: [] }]) {
    writeFileSync(file, JSON.stringify(value));assert.throws(() => readProps(file, "horizontal"));
  }
});
test("render entry point refuses invalid media before launching a browser", () => {
  const file = path.join(work, "invalid.json");const p = props();p.rooms[0].source.src = "walkthrough/no-such-file.mp4";
  writeFileSync(file, JSON.stringify(p));
  const result = spawnSync(process.execPath, ["walkthrough/tools/render.mjs", "Walkthrough-9x16", path.join(work, "out.mp4"), `--props=${file}`], {
    cwd: projectRoot, encoding: "utf8",
  });
  assert.equal(result.status, 1);assert.match(result.stderr, /Export abgebrochen/);
  assert.doesNotMatch(result.stderr, /Failed to launch the browser/);
});
