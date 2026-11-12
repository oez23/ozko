// Only synthetic test patterns and tones; never read customer media in CI.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./preflight.mjs";

const media = path.join(projectRoot, "public/walkthrough/ci");
const out = path.join(projectRoot, "out");
mkdirSync(media, { recursive: true });
mkdirSync(out, { recursive: true });
const ffmpeg = (args) => execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-n", ...args]);
ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(media, "video.mp4")]);
ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:duration=1", path.join(media, "voice.wav")]);
ffmpeg(["-f", "lavfi", "-i", "sine=frequency=220:duration=0.5", path.join(media, "music.wav")]);
const types = ["fade", "slide", "wipe", "cut"];
const props = {
  mode: "draft", title: "Synthetic CI test", introSec: 0, endCardSec: 0,
  showRoomLabels: true, showCaptions: true,
  rights: { ownerApproval: false, imageRightsCleared: false, privacyChecked: false },
  music: { src: "walkthrough/ci/music.wav", volume: 0.1 },
  rooms: Array.from({ length: 5 }, (_, i) => ({
    id: `room-${i}`, name: `Synthetic room ${i}`, method: "recorded", verification: "pending",
    source: { src: "walkthrough/ci/video.mp4", projection: "flat" },
    durationSec: i === 4 ? 0.7 : 2,
    ...(i < 4 ? { transitionToNext: { type: types[i], durationSec: 0.3 } } : {}),
    ...(i === 0 ? { voiceover: { text: "Synthetic audio test", audioSrc: "walkthrough/ci/voice.wav" } } : {}),
  })),
};
writeFileSync(path.join(out, "smoke-props.json"), JSON.stringify(props, null, 2));
