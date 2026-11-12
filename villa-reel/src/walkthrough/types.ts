// Data model of the Walkthrough Engine. Pure types and constants only:
// no Remotion imports, so validation and timeline logic stay testable in Node.

/** How a clip was produced. Determines labelling and which checks apply. */
export const WALKTHROUGH_METHODS = [
  "recorded", // smartphone / camera footage
  "gimbal", // stabilised camera move
  "360-export", // flat (already reprojected) export of a 360° recording
  "matterport-export", // video rendering exported from Matterport
  "polycam-export", // video rendering exported from Polycam
  "3dvista-export", // video rendering exported from 3DVista
  "3d-render", // camera path rendered from another 3D capture system
  "ai-transition", // AI image-to-video clip generated from real photos
] as const;
export type WalkthroughMethod = (typeof WALKTHROUGH_METHODS)[number];

/** Methods whose footage comes from a 3D capture and need a source reference. */
export const METHODS_FROM_3D: readonly WalkthroughMethod[] = [
  "matterport-export",
  "polycam-export",
  "3dvista-export",
  "3d-render",
];

/**
 * "flat" = conventional video. "equirectangular" = raw 360° frame; it must be
 * reprojected (see walkthrough/tools/preprocess.mjs) before it can be composed.
 */
export type Projection = "flat" | "equirectangular";

/** pending = not reviewed, verified = reviewed by a human, rejected = must not be used. */
export type VerificationStatus = "pending" | "verified" | "rejected";

export const TRANSITION_TYPES = ["cut", "fade", "slide", "wipe"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export type RoomTransition = {
  type: TransitionType;
  /** Ignored for "cut". */
  durationSec?: number;
};

/** Normalised point (0..1) of the source that stays in frame when cropping. */
export type Focus = { x: number; y: number };

export type SourceMedium = {
  /** Path relative to public/, must live under walkthrough/. Remote URLs are rejected. */
  src: string;
  projection: Projection;
};

/** Where the camera enters or leaves the room, e.g. "Tür zum Flur". Free text, shown nowhere. */
export type RoomPoint = { description: string };

export type AiProvenance = {
  provider: string;
  /** Real photo the clip starts from (path relative to public/). */
  startFrame: string;
  /** Real photo the clip ends on, if the provider supports an end frame. */
  endFrame?: string;
  /** A human compared the generated geometry with the real rooms. */
  geometryReviewed: boolean;
  /**
   * A human confirmed that the two rooms are really connected the way the clip shows.
   * Never set by code; without it the clip cannot be released.
   */
  connectionConfirmed: boolean;
};

export type Voiceover = {
  /** Spoken text; shown as caption when `showCaptions` is on. */
  text: string;
  /** Recorded audio, path relative to public/ under walkthrough/. */
  audioSrc?: string;
};

export type WalkthroughRoom = {
  id: string;
  name: string;
  method: WalkthroughMethod;
  source: SourceMedium;
  /** Length of the clip in the finished video, in seconds. */
  durationSec: number;
  /** Where in the source file the clip starts, in seconds. Default 0. */
  trimStartSec?: number;
  /** 1 = original speed. Default 1. */
  playbackRate?: number;
  entry?: RoomPoint;
  exit?: RoomPoint;
  /** Transition into the next room. Default: fade. */
  transitionToNext?: RoomTransition;
  verification: VerificationStatus;
  voiceover?: Voiceover;
  /** Crop focus per format; default is the centre. */
  focus?: { vertical?: Focus; horizontal?: Focus };
  /** Required for 3D exports: where the rendering comes from (tour ID, project name, file). */
  sourceReference?: string;
  /** Required for method "ai-transition". */
  ai?: AiProvenance;
};

export type Rights = {
  ownerApproval: boolean;
  imageRightsCleared: boolean;
  /** Faces, licence plates and personal documents were checked in all clips. */
  privacyChecked: boolean;
};

export type WalkthroughProps = {
  orientation: "vertical" | "horizontal";
  /**
   * "draft" renders anything that is not rejected and stamps it as a draft.
   * "final" only renders when every clip is verified and all rights are confirmed.
   */
  mode: "draft" | "final";
  title: string;
  subtitle?: string;
  rooms: WalkthroughRoom[];
  introSec: number;
  endCardSec: number;
  showRoomLabels: boolean;
  showCaptions: boolean;
  music?: { src: string; volume?: number };
  rights: Rights;
};

export const FPS = 30;
export const DEFAULT_TRANSITION: Required<RoomTransition> = {
  type: "fade",
  durationSec: 0.6,
};
