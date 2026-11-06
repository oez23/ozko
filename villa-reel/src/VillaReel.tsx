import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/fonts";
import {
  END_CARD,
  SCENE_FRAMES,
  SCENES,
  SUBTITLE,
  TITLE,
  TRANSITION,
  type FormatPlan,
  type Scene,
  type Viewport,
} from "./scenes";

// Cormorant Garamond (SIL Open Font License), bundled locally so renders need no network.
// latin-ext covers Turkish characters such as "ı".
const fontFamily = "Cormorant Garamond";
loadFont({
  family: fontFamily,
  url: staticFile("fonts/cormorant-garamond-500-latin.woff2"),
  weight: "500",
  unicodeRange:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
});
loadFont({
  family: fontFamily,
  url: staticFile("fonts/cormorant-garamond-500-latin-ext.woff2"),
  weight: "500",
  unicodeRange:
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
});

export type VillaReelProps = { orientation: "vertical" | "horizontal" };

const ease = Easing.inOut(Easing.cubic);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Places the photo so the viewport (in normalized photo coords) fills the frame. */
const coverStyle = (
  vp: Viewport,
  size: [number, number],
  frame: [number, number],
): React.CSSProperties => {
  const [iw, ih] = size;
  const [fw, fh] = frame;
  const frameAspect = fw / fh;
  // Viewport width in px of the source, never smaller than what still fills the frame.
  let vw = vp.w * iw;
  let vh = vw / frameAspect;
  if (vh > ih) {
    vh = ih;
    vw = vh * frameAspect;
  }
  if (vw > iw) {
    vw = iw;
    vh = vw / frameAspect;
  }
  // Clamp the centre so the viewport never leaves the photo (no empty edges).
  const cx = Math.min(Math.max(vp.cx * iw, vw / 2), iw - vw / 2);
  const cy = Math.min(Math.max(vp.cy * ih, vh / 2), ih - vh / 2);
  const scale = fw / vw;
  return {
    position: "absolute",
    width: iw * scale,
    height: ih * scale,
    left: -(cx - vw / 2) * scale,
    top: -(cy - vh / 2) * scale,
    maxWidth: "none",
  };
};

const PhotoScene: React.FC<{ scene: Scene; plan: FormatPlan }> = ({
  scene,
  plan,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = ease(
    interpolate(frame, [0, durationInFrames - 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const src = staticFile(scene.src);

  if (plan.mode === "cover") {
    const vp: Viewport = {
      cx: lerp(plan.from.cx, plan.to.cx, t),
      cy: lerp(plan.from.cy, plan.to.cy, t),
      w: lerp(plan.from.w, plan.to.w, t),
    };
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#111" }}>
        <Img src={src} style={coverStyle(vp, scene.size, [width, height])} />
      </AbsoluteFill>
    );
  }

  // Panel: portrait photo, full height, over a blurred copy of itself.
  const { crop } = plan;
  const [iw, ih] = scene.size;
  const cw = (crop.x1 - crop.x0) * iw;
  const ch = (crop.y1 - crop.y0) * ih;
  const zoom = lerp(1, plan.zoomTo, t);
  const panelH = height;
  const panelW = (cw / ch) * panelH;
  const s = panelH / ch;
  return (
    <AbsoluteFill style={{ backgroundColor: "#111", overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          ...coverStyle({ cx: 0.5, cy: 0.5, w: 1 }, scene.size, [width, height]),
          filter: "blur(40px) brightness(0.45)",
          transform: "scale(1.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: (width - panelW) / 2,
          top: 0,
          width: panelW,
          height: panelH,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <Img
          src={src}
          style={{
            position: "absolute",
            width: iw * s,
            height: ih * s,
            left: -crop.x0 * iw * s,
            top: -crop.y0 * ih * s,
            maxWidth: "none",
            transform: `scale(${zoom})`,
            transformOrigin: "50% 50%",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const TitleOverlay: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const opacity = interpolate(frame, [12, 30, 70, 86], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [12, 30], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        // Text sits on a soft bottom gradient for legibility, clear of
        // platform UI (reel captions/buttons occupy the lowest ~20%).
        paddingBottom: vertical ? 420 : 110,
        background:
          "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%)",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 500,
          color: "white",
          fontSize: vertical ? width * 0.085 : width * 0.045,
          letterSpacing: "0.04em",
          textShadow: "0 2px 14px rgba(0,0,0,0.5)",
          transform: `translateY(${y}px)`,
          textAlign: "center",
        }}
      >
        {TITLE}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const opacity = interpolate(frame, [TRANSITION, TRANSITION + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#141414" }}>
      <PhotoScene
        scene={SCENES[0]}
        plan={{
          mode: "cover",
          from: { cx: 0.62, cy: 0.52, w: 0.74 },
          to: { cx: 0.62, cy: 0.52, w: 0.7 },
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(15,15,15,0.62)",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 18,
          opacity,
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 500,
            color: "white",
            fontSize: vertical ? width * 0.09 : width * 0.05,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
        >
          {TITLE}
        </div>
        <div
          style={{
            width: vertical ? 120 : 160,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.7)",
          }}
        />
        {SUBTITLE ? (
          <div
            style={{
              fontFamily,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              fontSize: vertical ? width * 0.042 : width * 0.022,
              letterSpacing: "0.12em",
            }}
          >
            {SUBTITLE}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const VillaReel: React.FC<VillaReelProps> = ({ orientation }) => {
  const vertical = orientation === "vertical";
  const timing = linearTiming({ durationInFrames: TRANSITION });
  return (
    <AbsoluteFill style={{ backgroundColor: "#111" }}>
      <TransitionSeries>
        {SCENES.map((scene, i) => (
          <React.Fragment key={scene.id}>
            <TransitionSeries.Sequence
              durationInFrames={SCENE_FRAMES}
              name={scene.label}
            >
              <PhotoScene
                scene={scene}
                plan={vertical ? scene.vertical : scene.horizontal}
              />
              {i === 0 ? <TitleOverlay vertical={vertical} /> : null}
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={timing} />
          </React.Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={END_CARD} name="Abschluss">
          <EndCard vertical={vertical} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
