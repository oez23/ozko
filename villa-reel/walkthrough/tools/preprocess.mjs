#!/usr/bin/env node
// Optional FFmpeg preprocessing for walkthrough clips. Needs ffmpeg/ffprobe on PATH.
// Originals are never modified: every command writes a new file and refuses to overwrite.
//
//   node walkthrough/tools/preprocess.mjs probe <file>
//   node walkthrough/tools/preprocess.mjs stabilize <in> <out>
//   node walkthrough/tools/preprocess.mjs reproject360 <in> <out> [--yaw 0] [--pitch 0] [--fov 100] [--size 1920x1080]
//   node walkthrough/tools/preprocess.mjs testclips
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const fail = (message) => {
  console.error(`Fehler: ${message}`);
  process.exit(1);
};

const run = (bin, args, options = {}) => {
  const result = spawnSync(bin, args, { encoding: "utf8", ...options });
  if (result.error) fail(`${bin} nicht ausführbar: ${result.error.message}`);
  if (result.status !== 0) fail(`${bin} fehlgeschlagen:\n${result.stderr?.slice(-1500)}`);
  return result.stdout;
};

const checkPaths = (input, output) => {
  if (!input || !output) fail("Eingabe- und Ausgabedatei angeben.");
  if (!existsSync(input)) fail(`Eingabe nicht gefunden: ${input}`);
  if (path.resolve(input) === path.resolve(output)) fail("Ausgabe darf nicht die Eingabe sein.");
  if (existsSync(output)) fail(`Ausgabe existiert bereits: ${output}`);
  mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
};

const flag = (args, name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

export const probe = (file) => {
  if (!existsSync(file)) fail(`Datei nicht gefunden: ${file}`);
  const json = JSON.parse(
    run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_streams", "-show_format", "-of", "json", file]),
  );
  const stream = json.streams?.[0];
  if (!stream) fail("Keine Videospur gefunden.");
  const sphericalTag = (stream.side_data_list ?? []).some((d) =>
    /spherical/i.test(d.side_data_type ?? ""),
  );
  const width = stream.width;
  const height = stream.height;
  return {
    width,
    height,
    durationSec: Number(json.format?.duration ?? stream.duration ?? 0),
    codec: stream.codec_name,
    sphericalTag,
    projection: sphericalTag || Math.abs(width / height - 2) < 0.01 ? "equirectangular" : "flat",
  };
};

const encode = ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

const [command, ...args] = process.argv.slice(2);

if (command === "probe") {
  console.log(JSON.stringify(probe(args[0]), null, 2));
} else if (command === "stabilize") {
  const [input, output] = args;
  checkPaths(input, output);
  const work = mkdtempSync(path.join(tmpdir(), "vidstab-"));
  const trf = path.join(work, "transforms.trf");
  try {
    // Pass 1 analyses the shake, pass 2 applies the smoothed camera path.
    run("ffmpeg", ["-v", "error", "-i", input, "-vf", `vidstabdetect=shakiness=5:result=${trf}`, "-f", "null", "-"]);
    run("ffmpeg", ["-v", "error", "-i", input, "-vf", `vidstabtransform=input=${trf}:smoothing=30:zoom=2,unsharp=5:5:0.6`, ...encode, "-c:a", "copy", output]);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`Stabilisiert: ${output}`);
} else if (command === "reproject360") {
  const [input, output] = args;
  checkPaths(input, output);
  if (probe(input).projection !== "equirectangular") {
    fail("Quelle ist nicht equirectangular (kein 2:1-Bild, kein Spherical-Tag) – keine Umrechnung.");
  }
  const [w, h] = String(flag(args, "size", "1920x1080")).split("x").map(Number);
  const hFov = Number(flag(args, "fov", 100));
  if (!(w > 0 && h > 0 && hFov > 0 && hFov < 180)) fail("Ungültige --size oder --fov.");
  // Vertical field of view that matches the output aspect (rectilinear projection).
  const vFov = (2 * Math.atan(Math.tan((hFov * Math.PI) / 360) * (h / w)) * 180) / Math.PI;
  const filter = `v360=input=e:output=flat:yaw=${Number(flag(args, "yaw", 0))}:pitch=${Number(flag(args, "pitch", 0))}:h_fov=${hFov}:v_fov=${vFov.toFixed(3)}:w=${w}:h=${h}`;
  run("ffmpeg", ["-v", "error", "-i", input, "-vf", filter, ...encode, "-an", output]);
  console.log(`Flach projiziert: ${output}`);
} else if (command === "testclips") {
  // Synthetic test material: slow zooms over the existing photos. Not camera footage.
  const out = path.join(root, "public/walkthrough/test");
  mkdirSync(out, { recursive: true });
  const photos = ["04-wohnzimmer", "05-kueche", "06-treppe", "07-hauptschlafzimmer", "09-bad", "02-terrasse-pool"];
  for (const name of photos) {
    const target = path.join(out, `${name}.mp4`);
    if (existsSync(target)) continue;
    run("ffmpeg", [
      "-v", "error", "-loop", "1", "-i", path.join(root, "public/photos", `${name}.webp`),
      "-vf", "scale=1920:1920:force_original_aspect_ratio=increase,crop=1920:1920,zoompan=z='1+0.0012*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1440x1440:fps=30",
      "-t", "6", ...encode, "-crf", "26", target,
    ]);
    console.log(`Testclip: ${path.relative(root, target)}`);
  }
} else {
  fail("Befehl: probe | stabilize | reproject360 | testclips");
}
