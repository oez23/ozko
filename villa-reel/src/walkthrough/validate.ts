// Validation of walkthrough props. Pure, no Remotion imports.
// Errors stop the render; warnings are printed but do not block a draft.
import { buildTimeline, secToFrames } from "./scenes.ts";
import {
  METHODS_FROM_3D,
  DEFAULT_TRANSITION,
  TRANSITION_TYPES,
  WALKTHROUGH_METHODS,
  type WalkthroughProps,
  type WalkthroughRoom,
} from "./types.ts";

export type Issue = { level: "error" | "warning"; path: string; message: string };

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const TOUR_HOST = /matterport\.com|3dvista|kuula\.co/i;

/**
 * Media must be a local file below public/walkthrough/ (or public/photos/ for
 * AI start frames). No URLs, no absolute paths, no "..".
 */
export const checkMediaPath = (
  src: unknown,
  ext: RegExp,
  roots: string[] = ["walkthrough/"],
): string | null => {
  if (typeof src !== "string" || src.length === 0) return "fehlt";
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//")) {
    return TOUR_HOST.test(src)
      ? "ist eine interaktive Tour, keine Videodatei – dafür die Viewer-Komponente (tour/) verwenden"
      : "ist eine URL – nur lokale Dateien unter public/ sind erlaubt";
  }
  if (src.startsWith("/") || src.includes("\\") || src.split("/").includes("..")) {
    return "muss ein relativer Pfad ohne '..' sein";
  }
  if (!roots.some((root) => src.startsWith(root))) {
    return `muss unter ${roots.map((r) => `public/${r}`).join(" oder ")} liegen`;
  }
  if (!ext.test(src)) return "hat keinen erlaubten Dateityp";
  return null;
};

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const hasText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

export type ValidationOptions = { allowEmptyDraft?: boolean };

const validateRoom = (
  room: WalkthroughRoom,
  path: string,
  final: boolean,
  issues: Issue[],
) => {
  const err = (field: string, message: string) =>
    issues.push({ level: "error", path: `${path}.${field}`, message });

  if (typeof room.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(room.id)) {
    err("id", "nur Kleinbuchstaben, Ziffern und Bindestriche");
  }
  if (!hasText(room.name)) err("name", "muss ein nichtleerer Text sein");
  if (!WALKTHROUGH_METHODS.includes(room.method)) {
    err("method", `unbekannt: ${String(room.method)}`);
  }

  const srcProblem = checkMediaPath(room.source?.src, VIDEO_EXT);
  if (srcProblem) err("source.src", srcProblem);
  if (room.source?.projection === "equirectangular") {
    err(
      "source.projection",
      "equirectangulare 360°-Quelle – zuerst mit 'preprocess.mjs reproject360' in ein flaches Video umrechnen",
    );
  } else if (room.source?.projection !== "flat") {
    err("source.projection", "muss 'flat' oder 'equirectangular' sein");
  }

  if (!isNum(room.durationSec) || room.durationSec < 0.5 || room.durationSec > 120) {
    err("durationSec", "muss zwischen 0,5 und 120 Sekunden liegen");
  }
  if (room.trimStartSec !== undefined && (!isNum(room.trimStartSec) || room.trimStartSec < 0)) {
    err("trimStartSec", "darf nicht negativ sein");
  }
  if (
    room.playbackRate !== undefined &&
    (!isNum(room.playbackRate) || room.playbackRate < 0.25 || room.playbackRate > 4)
  ) {
    err("playbackRate", "muss zwischen 0,25 und 4 liegen");
  }
  if (room.transitionToNext !== undefined) {
    if (!isRecord(room.transitionToNext)) {
      err("transitionToNext", "muss ein Objekt sein");
    } else {
      const t = room.transitionToNext;
      if (!TRANSITION_TYPES.includes(t.type)) {
        err("transitionToNext.type", `unbekannt: ${String(t.type)}`);
      }
      if (t.durationSec !== undefined && (!isNum(t.durationSec) || t.durationSec < 0)) {
        err("transitionToNext.durationSec", "muss eine endliche, nichtnegative Zahl sein");
      } else if (t.type !== "cut" && secToFrames(t.durationSec ?? DEFAULT_TRANSITION.durationSec) < 1) {
        err("transitionToNext.durationSec", "muss nach Rundung mindestens einen Frame ergeben");
      }
    }
  }
  for (const key of ["vertical", "horizontal"] as const) {
    const f = room.focus?.[key];
    if (f && !(isNum(f.x) && isNum(f.y) && f.x >= 0 && f.x <= 1 && f.y >= 0 && f.y <= 1)) {
      err(`focus.${key}`, "x und y müssen zwischen 0 und 1 liegen");
    }
  }
  if (room.voiceover?.audioSrc !== undefined) {
    const p = checkMediaPath(room.voiceover.audioSrc, AUDIO_EXT);
    if (p) err("voiceover.audioSrc", p);
  }
  if (room.voiceover !== undefined && (!isRecord(room.voiceover) || !hasText(room.voiceover.text))) {
    err("voiceover", "muss ein Objekt mit nichtleerem Sprechertext sein");
  }

  if (!["pending", "verified", "rejected"].includes(room.verification)) {
    err("verification", "muss pending, verified oder rejected sein");
  }
  if (final && room.verification !== "verified") {
    err("verification", "im Modus 'final' müssen alle Clips geprüft (verified) sein");
  }

  // No 3D export without naming where it comes from.
  if (METHODS_FROM_3D.includes(room.method) && !hasText(room.sourceReference)) {
    err("sourceReference", "3D-Export ohne Quellenangabe (Tour-ID, Projekt oder Datei)");
  }

  if (room.method === "ai-transition") {
    const ai = room.ai;
    if (!ai) {
      err("ai", "KI-Clip ohne Herkunftsangaben");
    } else {
      if (!hasText(ai.provider)) err("ai.provider", "muss ein nichtleerer Text sein");
      const start = checkMediaPath(ai.startFrame, IMAGE_EXT, ["walkthrough/", "photos/"]);
      if (start) err("ai.startFrame", start);
      if (ai.endFrame !== undefined) {
        const end = checkMediaPath(ai.endFrame, IMAGE_EXT, ["walkthrough/", "photos/"]);
        if (end) err("ai.endFrame", end);
      }
      if (final && ai.geometryReviewed !== true) {
        err("ai.geometryReviewed", "Raumgeometrie wurde nicht geprüft");
      }
      if (final && ai.connectionConfirmed !== true) {
        err("ai.connectionConfirmed", "Verbindung der Räume wurde nicht bestätigt");
      }
    }
  } else if (room.ai) {
    err("ai", "Herkunftsangaben nur bei method 'ai-transition'");
  }
};

export const validateWalkthrough = (
  props: WalkthroughProps,
  options: ValidationOptions = {},
): Issue[] => {
  const issues: Issue[] = [];
  const err = (path: string, message: string) =>
    issues.push({ level: "error", path, message });
  if (!isRecord(props)) {
    err("props", "muss ein Objekt sein");
    return issues;
  }
  const final = props.mode === "final";

  if (props.orientation !== "vertical" && props.orientation !== "horizontal") {
    err("orientation", "muss vertical oder horizontal sein");
  }
  if (props.mode !== "draft" && props.mode !== "final") {
    err("mode", "muss draft oder final sein");
  }
  if (!hasText(props.title)) err("title", "muss ein nichtleerer Text sein");
  if (props.subtitle !== undefined && typeof props.subtitle !== "string") {
    err("subtitle", "muss ein Text sein");
  }
  for (const key of ["showRoomLabels", "showCaptions"] as const) {
    if (typeof props[key] !== "boolean") err(key, "muss true oder false sein");
  }
  for (const key of ["introSec", "endCardSec"] as const) {
    if (!isNum(props[key]) || props[key] < 0 || props[key] > 15) {
      err(key, "muss zwischen 0 und 15 Sekunden liegen");
    } else if (props[key] > 0 && secToFrames(props[key]) < 1) {
      err(key, "muss 0 oder mindestens einen Frame lang sein");
    }
  }
  if (props.music !== undefined && !isRecord(props.music)) {
    err("music", "muss ein Objekt sein");
  } else if (props.music) {
    const p = checkMediaPath(props.music.src, AUDIO_EXT);
    if (p) err("music.src", p);
    const volume = props.music.volume;
    if (volume !== undefined && (!isNum(volume) || volume < 0 || volume > 1)) {
      err("music.volume", "muss zwischen 0 und 1 liegen");
    }
  }

  if (!Array.isArray(props.rooms) || props.rooms.length === 0) {
    if (!(Array.isArray(props.rooms) && props.rooms.length === 0 && props.mode === "draft" && options.allowEmptyDraft)) {
      err("rooms", "mindestens ein Raum nötig");
    }
    return issues;
  }
  const seen = new Set<string>();
  props.rooms.forEach((room, i) => {
    const path = `rooms[${i}]`;
    if (!isRecord(room)) {
      err(path, "muss ein Raum-Objekt sein");
      return;
    }
    if (seen.has(room.id)) err(`${path}.id`, `doppelt: ${room.id}`);
    seen.add(room.id);
    validateRoom(room, path, final, issues);
  });

  if (final) {
    const r = props.rights;
    if (r?.ownerApproval !== true) err("rights.ownerApproval", "Eigentümerfreigabe fehlt");
    if (r?.imageRightsCleared !== true) err("rights.imageRightsCleared", "Bildrechte nicht geklärt");
    if (r?.privacyChecked !== true) {
      err("rights.privacyChecked", "Gesichter, Kennzeichen und Dokumente nicht geprüft");
    }
  }

  if (issues.some((i) => i.level === "error")) return issues;

  // A transition must be shorter than both clips it connects.
  const { segments } = buildTimeline(props);
  if (!segments.some((s) => s.kind === "room")) {
    err("rooms", "alle Clips sind abgelehnt (rejected)");
  }
  segments.forEach((s, i) => {
    const next = segments[i + 1];
    const t = s.transitionAfter?.frames ?? 0;
    if (next && t > 0 && (t >= s.frames || t >= next.frames)) {
      err(
        s.room ? `rooms(${s.room.id}).transitionToNext` : s.kind,
        "Übergang ist länger als einer der beiden Clips",
      );
    }
  });
  if (secToFrames(props.introSec) === 0 && secToFrames(props.endCardSec) === 0) {
    issues.push({
      level: "warning",
      path: "introSec",
      message: "ohne Intro und Endcard fehlt das Villanya-Branding",
    });
  }
  return issues;
};

/** Throws with a readable list when there are errors. Used by calculateMetadata. */
export const assertValidWalkthrough = (
  props: WalkthroughProps,
  options: ValidationOptions = {},
): Issue[] => {
  const issues = validateWalkthrough(props, options);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    throw new Error(
      `Walkthrough-Konfiguration ungültig:\n${errors
        .map((e) => `  - ${e.path}: ${e.message}`)
        .join("\n")}`,
    );
  }
  return issues;
};
