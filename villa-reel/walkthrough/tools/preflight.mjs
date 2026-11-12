// Server/CLI only. Do not import filesystem or credentials into the video bundle.
import { execFileSync } from "node:child_process";
import { realpathSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertValidWalkthrough } from "../../src/walkthrough/validate.ts";
import { EMPTY_WALKTHROUGH } from "../../src/walkthrough/metadata.ts";
import { sourceSecondsNeeded } from "../../src/walkthrough/providers/video-import.ts";
import { FPS } from "../../src/walkthrough/types.ts";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
};

export const localMedia = (publicDir, src, roots = ["walkthrough"]) => {
  const root = realpathSync(publicDir);
  const file = realpathSync(path.resolve(root, src));
  // Check against the public root's actual subdirectory, not a symlinked root.
  if (!roots.some((name) => inside(path.join(root, name), file)) || !statSync(file).isFile()) {
    throw new Error(`${src}: keine lokale Datei im freigegebenen Medienordner`);
  }
  return file;
};

const ffprobe = (file, args) => JSON.parse(execFileSync("ffprobe", [
  "-v", "error", "-protocol_whitelist", "file,pipe", ...args, "-of", "json", file,
], { encoding: "utf8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024 }));

const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const taggedDuration = (text) => {
  if (typeof text !== "string" || !/^\d+:\d{2}:\d{2}(\.\d+)?$/.test(text)) return 0;
  const [h, m, s] = text.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

/** Never use container duration: another stream may be longer than the video. */
export const probeTrack = (file, kind) => {
  const selector = kind === "video" ? "v:0" : "a:0";
  const json = ffprobe(file, ["-select_streams", selector, "-show_streams"]);
  const stream = json.streams?.[0];
  if (!stream) throw new Error(`${path.basename(file)}: keine ${kind}-Spur`);
  let duration = Number(stream.duration);
  if (!positive(duration)) duration = taggedDuration(stream.tags?.DURATION);
  if (!positive(duration)) {
    const packets = ffprobe(file, ["-select_streams", selector, "-show_packets", "-show_entries", "packet=pts_time,duration_time"]);
    const times = (packets.packets ?? []).filter((p) => Number.isFinite(Number(p.pts_time)));
    let first = Infinity;
    let last = -Infinity;
    for (const packet of times) {
      const start = Number(packet.pts_time);
      first = Math.min(first, start);
      last = Math.max(last, start + (positive(packet.duration_time) ? Number(packet.duration_time) : 0));
    }
    duration = last - first;
  }
  if (!positive(duration)) throw new Error(`${path.basename(file)}: Spurdauer nicht bestimmbar`);
  if (kind === "video" && !(stream.width > 0 && stream.height > 0 && stream.codec_name)) {
    throw new Error(`${path.basename(file)}: ungültige Videospur`);
  }
  return { durationSec: duration, codec: stream.codec_name, width: stream.width, height: stream.height };
};

export const readProps = (file, orientation) => {
  const input = JSON.parse(readFileSync(file, "utf8"));
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Props müssen ein Objekt sein");
  const props = { ...EMPTY_WALKTHROUGH, ...input, orientation };
  assertValidWalkthrough(props);
  return props;
};

export const preflight = (props, { publicDir = path.join(projectRoot, "public") } = {}) => {
  assertValidWalkthrough(props);
  const checked = [];
  for (const room of props.rooms.filter((r) => r.verification !== "rejected")) {
    const file = localMedia(publicDir, room.source.src);
    const track = probeTrack(file, "video");
    const tolerance = (room.playbackRate ?? 1) / FPS + 0.001;
    const needed = sourceSecondsNeeded(room);
    if (needed > track.durationSec + tolerance) {
      throw new Error(`${room.id}: benötigt ${needed.toFixed(3)}s Quelle, vorhanden ${track.durationSec.toFixed(3)}s`);
    }
    if (room.voiceover?.audioSrc) {
      const audio = probeTrack(localMedia(publicDir, room.voiceover.audioSrc), "audio");
      if (audio.durationSec > room.durationSec + 1 / FPS) {
        throw new Error(`${room.id}: Sprecheraufnahme ist länger als die Szene und würde abgeschnitten`);
      }
    }
    if (room.ai) {
      localMedia(publicDir, room.ai.startFrame, ["walkthrough", "photos"]);
      if (room.ai.endFrame) localMedia(publicDir, room.ai.endFrame, ["walkthrough", "photos"]);
    }
    checked.push({ id: room.id, ...track });
  }
  if (props.music) probeTrack(localMedia(publicDir, props.music.src), "audio");
  return checked;
};
