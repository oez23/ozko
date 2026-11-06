// Storyboard: single source of truth for both formats.
// Coordinates are normalized to the source photo (0..1).
// "cover": a frame-aspect viewport moves from `from` to `to` (Ken Burns).
//   cx/cy = viewport centre, w = viewport width as a fraction of photo width.
// "panel": used for portrait photos in 16:9 — a fixed crop is shown full-height,
//   centred over a blurred, darkened copy of the same photo.

export type Viewport = { cx: number; cy: number; w: number };

export type FormatPlan =
  | { mode: "cover"; from: Viewport; to: Viewport }
  | {
      mode: "panel";
      crop: { x0: number; y0: number; x1: number; y1: number };
      zoomTo: number;
    };

export type Scene = {
  id: string;
  src: string;
  /** Source photo size in px (needed to compute aspect ratios). */
  size: [number, number];
  label: string;
  /** Why the crop is the way it is — kept with the data so it survives edits. */
  note?: string;
  vertical: FormatPlan;
  horizontal: FormatPlan;
};

const L: [number, number] = [2000, 1500];
const P: [number, number] = [1500, 2000];

export const SCENES: Scene[] = [
  // Opening shot: strongest exterior (house, terrace, pool). The street-side
  // photo was dropped: weaker composition, neighbouring houses and a readable plate.
  {
    id: "terrasse",
    src: "photos/02-terrasse-pool.webp",
    size: L,
    label: "Terrasse & Pool",
    note: "Schuhe unten links (x 0.15–0.24, y>0.82) werden ausgeschnitten.",
    vertical: {
      mode: "cover",
      from: { cx: 0.62, cy: 0.5, w: 0.42 },
      to: { cx: 0.56, cy: 0.5, w: 0.4 },
    },
    horizontal: {
      // x stays ≥ 0.26 so the shoes (x 0.15–0.24) never enter; low enough to show the pool.
      mode: "cover",
      from: { cx: 0.63, cy: 0.56, w: 0.74 },
      to: { cx: 0.66, cy: 0.58, w: 0.68 },
    },
  },
  {
    id: "pool-meerblick",
    src: "photos/03-pool-meerblick.webp",
    size: L,
    label: "Pool mit Meerblick",
    vertical: {
      mode: "cover",
      from: { cx: 0.36, cy: 0.5, w: 0.4 },
      to: { cx: 0.4, cy: 0.5, w: 0.42 },
    },
    horizontal: {
      mode: "cover",
      from: { cx: 0.5, cy: 0.6, w: 0.92 },
      to: { cx: 0.5, cy: 0.55, w: 1 },
    },
  },
  {
    id: "wohnzimmer",
    src: "photos/04-wohnzimmer.webp",
    size: L,
    label: "Wohnbereich",
    vertical: {
      mode: "cover",
      from: { cx: 0.3, cy: 0.5, w: 0.42 },
      to: { cx: 0.62, cy: 0.5, w: 0.42 },
    },
    horizontal: {
      mode: "cover",
      from: { cx: 0.5, cy: 0.5, w: 0.96 },
      to: { cx: 0.52, cy: 0.5, w: 0.86 },
    },
  },
  {
    id: "kueche",
    src: "photos/05-kueche.webp",
    size: L,
    label: "Küche",
    vertical: {
      mode: "cover",
      from: { cx: 0.36, cy: 0.5, w: 0.42 },
      to: { cx: 0.5, cy: 0.5, w: 0.42 },
    },
    horizontal: {
      mode: "cover",
      from: { cx: 0.46, cy: 0.5, w: 0.9 },
      to: { cx: 0.44, cy: 0.5, w: 0.98 },
    },
  },
  {
    id: "treppe",
    src: "photos/06-treppe.webp",
    size: P,
    label: "Marmortreppe",
    vertical: {
      mode: "cover",
      from: { cx: 0.42, cy: 0.5, w: 0.74 },
      to: { cx: 0.46, cy: 0.46, w: 0.66 },
    },
    horizontal: {
      mode: "panel",
      crop: { x0: 0, y0: 0, x1: 1, y1: 1 },
      zoomTo: 1.04,
    },
  },
  {
    id: "hauptschlafzimmer",
    src: "photos/07-hauptschlafzimmer.webp",
    size: P,
    label: "Hauptschlafzimmer",
    vertical: {
      mode: "cover",
      from: { cx: 0.5, cy: 0.5, w: 0.75 },
      to: { cx: 0.52, cy: 0.48, w: 0.68 },
    },
    horizontal: {
      mode: "panel",
      crop: { x0: 0, y0: 0, x1: 1, y1: 1 },
      zoomTo: 1.04,
    },
  },
  {
    id: "schlafzimmer",
    src: "photos/08-schlafzimmer.webp",
    size: L,
    label: "Schlafzimmer",
    vertical: {
      mode: "cover",
      from: { cx: 0.42, cy: 0.5, w: 0.42 },
      to: { cx: 0.5, cy: 0.5, w: 0.4 },
    },
    horizontal: {
      mode: "cover",
      from: { cx: 0.5, cy: 0.5, w: 0.9 },
      to: { cx: 0.5, cy: 0.5, w: 0.98 },
    },
  },
  {
    id: "bad",
    src: "photos/09-bad.webp",
    size: P,
    label: "Badezimmer",
    note: "Gespiegelte Hand am rechten Rand (x>0.95, y≈0.3) wird in beiden Formaten ausgeschnitten.",
    vertical: {
      mode: "cover",
      from: { cx: 0.46, cy: 0.52, w: 0.7 },
      to: { cx: 0.44, cy: 0.5, w: 0.74 },
    },
    horizontal: {
      mode: "panel",
      crop: { x0: 0, y0: 0, x1: 0.9, y1: 1 },
      zoomTo: 1.04,
    },
  },
];

export const FPS = 30;
export const TOTAL_FRAMES = 750; // 25 s
export const TRANSITION = 18; // 0.6 s cross-fade
export const END_CARD = 102;
// Scene length chosen so the timeline (scenes + end card − overlaps) is exactly 750 frames.
export const SCENE_FRAMES = Math.round(
  (TOTAL_FRAMES + SCENES.length * TRANSITION - END_CARD) / SCENES.length,
);

// Only owner-confirmed property facts go here. So far only the location is confirmed.
// Add e.g. name, size, rooms, contact here once the owner confirms them.
export const TITLE = "Villa in Kargıcak";
export const SUBTITLE: string | null = null;
