import { Composition } from "remotion";
import { VillaReel } from "./VillaReel";
import { FPS, TOTAL_FRAMES } from "./scenes";

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
    </>
  );
};
