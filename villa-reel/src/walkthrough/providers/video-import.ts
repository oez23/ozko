// Builds room entries from imported video files (camera footage, 360° exports,
// 3D renderings). Pure, no Remotion imports.
import type {
  Projection,
  WalkthroughMethod,
  WalkthroughRoom,
} from "../types.ts";

export type ProbeResult = {
  width: number;
  height: number;
  durationSec: number;
  /** Spherical metadata tag found in the file (set by 360° cameras and exporters). */
  sphericalTag: boolean;
};

/**
 * A file counts as equirectangular when it carries the spherical tag or has
 * the 2:1 frame of a full 360° panorama. A wrong guess is safe either way:
 * the user sets `projection` explicitly and validation blocks equirectangular input.
 */
export const guessProjection = (probe: ProbeResult): Projection =>
  probe.sphericalTag || Math.abs(probe.width / probe.height - 2) < 0.01
    ? "equirectangular"
    : "flat";

export type VideoImport = {
  id: string;
  name: string;
  /** Path relative to public/, below walkthrough/. */
  src: string;
  method: Exclude<WalkthroughMethod, "ai-transition">;
  durationSec: number;
  projection?: Projection;
  trimStartSec?: number;
  playbackRate?: number;
  sourceReference?: string;
};

/** Imported clips always start as "pending" until a human has watched them. */
export const importVideo = (clip: VideoImport): WalkthroughRoom => ({
  id: clip.id,
  name: clip.name,
  method: clip.method,
  source: { src: clip.src, projection: clip.projection ?? "flat" },
  durationSec: clip.durationSec,
  trimStartSec: clip.trimStartSec,
  playbackRate: clip.playbackRate,
  sourceReference: clip.sourceReference,
  verification: "pending",
});

/** Seconds of source material a clip consumes; must fit into the file. */
export const sourceSecondsNeeded = (room: WalkthroughRoom): number =>
  (room.trimStartSec ?? 0) + room.durationSec * (room.playbackRate ?? 1);
