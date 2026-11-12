import { Composition } from "remotion";
import { VillaReel } from "./VillaReel";
import { FPS, TOTAL_FRAMES } from "./scenes";
import { Walkthrough } from "./walkthrough/Walkthrough";
import {
  EMPTY_WALKTHROUGH,
  walkthroughMetadata,
} from "./walkthrough/metadata";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VillaReel-9x16"
        component={VillaReel}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ orientation: "vertical" as const }}
      />
      <Composition
        id="VillaReel-16x9"
        component={VillaReel}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ orientation: "horizontal" as const }}
      />
      {/* Walkthroughs: clips and duration come from --props (see walkthrough/README.md). */}
      <Composition
        id="Walkthrough-9x16"
        component={Walkthrough}
        durationInFrames={90}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...EMPTY_WALKTHROUGH, orientation: "vertical" as const }}
        calculateMetadata={walkthroughMetadata("vertical")}
      />
      <Composition
        id="Walkthrough-16x9"
        component={Walkthrough}
        durationInFrames={90}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={EMPTY_WALKTHROUGH}
        calculateMetadata={walkthroughMetadata("horizontal")}
      />
    </>
  );
};
