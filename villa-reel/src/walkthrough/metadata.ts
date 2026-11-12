import type { CalculateMetadataFunction } from "remotion";
import { buildTimeline } from "./scenes.ts";
import { FPS, type WalkthroughProps } from "./types.ts";
import { assertValidWalkthrough } from "./validate.ts";

export const EMPTY_WALKTHROUGH: WalkthroughProps = {
  orientation: "horizontal",
  mode: "draft",
  title: "Villanya Real Estate",
  rooms: [],
  introSec: 2,
  endCardSec: 3,
  showRoomLabels: true,
  showCaptions: false,
  rights: { ownerApproval: false, imageRightsCleared: false, privacyChecked: false },
};

/**
 * Validates the props and derives the duration from the clips.
 * The orientation always follows the composition, whatever the props file says.
 */
export const walkthroughMetadata =
  (
    orientation: WalkthroughProps["orientation"],
  ): CalculateMetadataFunction<WalkthroughProps> =>
  ({ props }) => {
    const merged: WalkthroughProps = { ...EMPTY_WALKTHROUGH, ...props, orientation };
    if (merged.rooms.length === 0) {
      // Placeholder card only; nothing publishable is rendered.
      return { durationInFrames: 3 * FPS, fps: FPS, props: merged };
    }
    for (const issue of assertValidWalkthrough(merged)) {
      console.warn(`Walkthrough: ${issue.path}: ${issue.message}`);
    }
    return {
      durationInFrames: buildTimeline(merged).totalFrames,
      fps: FPS,
      props: merged,
    };
  };
