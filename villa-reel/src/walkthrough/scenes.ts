// Room order and timeline maths. Pure functions, no Remotion imports.
import {
  DEFAULT_TRANSITION,
  FPS,
  type TransitionType,
  type WalkthroughProps,
  type WalkthroughRoom,
} from "./types.ts";

/** Default tour order. Per property, simply order `rooms` differently in the props. */
export const DEFAULT_ROOM_ORDER = [
  "eingang",
  "wohnzimmer",
  "kueche",
  "flur",
  "schlafzimmer",
  "badezimmer",
  "terrasse",
] as const;

/**
 * Sorts rooms by a list of ids. Rooms missing from `order` keep their relative
 * position at the end; ids in `order` without a room are ignored (no room is invented).
 */
export const orderRooms = (
  rooms: WalkthroughRoom[],
  order: readonly string[] = DEFAULT_ROOM_ORDER,
): WalkthroughRoom[] => {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return rooms
    .map((room, index) => ({ room, index }))
    .sort((a, b) => rank(a.room.id) - rank(b.room.id) || a.index - b.index)
    .map(({ room }) => room);
};

export const secToFrames = (sec: number) => Math.max(0, Math.round(sec * FPS));

export type Segment = {
  kind: "intro" | "room" | "endcard";
  frames: number;
  room?: WalkthroughRoom;
  /** Transition into the following segment; frames = 0 means hard cut. */
  transitionAfter?: { type: TransitionType; frames: number };
};

const FADE = secToFrames(DEFAULT_TRANSITION.durationSec);

/** Rejected clips never reach the timeline, in any mode. */
export const usableRooms = (props: WalkthroughProps) =>
  props.rooms.filter((room) => room.verification !== "rejected");

export const buildTimeline = (
  props: WalkthroughProps,
): { segments: Segment[]; totalFrames: number } => {
  const rooms = usableRooms(props);
  const segments: Segment[] = [];

  const intro = secToFrames(props.introSec);
  if (intro > 0) {
    segments.push({
      kind: "intro",
      frames: intro,
      transitionAfter: { type: "fade", frames: FADE },
    });
  }

  rooms.forEach((room, i) => {
    const isLast = i === rooms.length - 1;
    const t = room.transitionToNext ?? DEFAULT_TRANSITION;
    // The last room always fades into the end card.
    const type: TransitionType = isLast ? "fade" : t.type;
    const frames =
      type === "cut"
        ? 0
        : secToFrames(
            isLast
              ? DEFAULT_TRANSITION.durationSec
              : (t.durationSec ?? DEFAULT_TRANSITION.durationSec),
          );
    segments.push({
      kind: "room",
      frames: secToFrames(room.durationSec),
      room,
      transitionAfter: { type, frames },
    });
  });

  const endCard = secToFrames(props.endCardSec);
  if (endCard > 0) {
    segments.push({ kind: "endcard", frames: endCard });
  } else if (segments.length > 0) {
    delete segments[segments.length - 1].transitionAfter;
  }

  // Overlapping transitions shorten the timeline by their length.
  const totalFrames = segments.reduce(
    (sum, s, i) =>
      sum +
      s.frames -
      (i < segments.length - 1 ? (s.transitionAfter?.frames ?? 0) : 0),
    0,
  );
  return { segments, totalFrames: Math.max(1, totalFrames) };
};
