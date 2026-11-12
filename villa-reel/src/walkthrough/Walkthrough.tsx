import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fontFamily } from "../font";
import { buildTimeline, secToFrames } from "./scenes.ts";
import { presentationFor } from "./transitions.ts";
import { labelOpacity as getLabelOpacity } from "./opacity.ts";
import type { WalkthroughProps, WalkthroughRoom } from "./types.ts";

const GOLD = "#e6cb91";
const INK = "#111";

const text = (size: number): React.CSSProperties => ({
  fontFamily,
  fontWeight: 500,
  fontSize: size,
  color: "white",
});

/** Small tag in a corner: used for the AI notice and the draft stamp. */
const Tag: React.FC<{
  children: React.ReactNode;
  side: "left" | "right";
  vertical: boolean;
  gold?: boolean;
}> = ({ children, side, vertical, gold }) => {
  const { width } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        // Vertical: stay below the platform header (top ~12 %).
        top: vertical ? 250 : 48,
        [side]: vertical ? 48 : 56,
        padding: "12px 20px",
        backgroundColor: "rgba(0,0,0,0.62)",
        border: `1px solid ${gold ? GOLD : "rgba(255,255,255,0.55)"}`,
        ...text(vertical ? width * 0.03 : width * 0.0145),
        color: gold ? GOLD : "white",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </div>
  );
};

const RoomClip: React.FC<{ room: WalkthroughRoom; props: WalkthroughProps }> = ({
  room,
  props,
}) => {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  const vertical = props.orientation === "vertical";
  const focus = (vertical ? room.focus?.vertical : room.focus?.horizontal) ?? {
    x: 0.5,
    y: 0.5,
  };
  const labelOpacity = getLabelOpacity(frame, durationInFrames);
  const caption = props.showCaptions ? room.voiceover?.text : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      {/* objectFit "cover" fills the frame in both formats: no black bars. */}
      <OffthreadVideo
        src={staticFile(room.source.src)}
        muted
        trimBefore={secToFrames(room.trimStartSec ?? 0)}
        playbackRate={room.playbackRate ?? 1}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${focus.x * 100}% ${focus.y * 100}%`,
        }}
      />
      {room.voiceover?.audioSrc ? (
        <Audio src={staticFile(room.voiceover.audioSrc)} />
      ) : null}

      {props.showRoomLabels || caption ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            // Vertical: keep clear of captions/buttons in the lowest ~20 %.
            padding: vertical ? "0 60px 420px" : "0 72px 84px",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 40%)",
            opacity: labelOpacity,
          }}
        >
          {props.showRoomLabels ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 48, height: 2, backgroundColor: GOLD }} />
              <div
                style={{
                  ...text(vertical ? width * 0.058 : width * 0.03),
                  letterSpacing: "0.04em",
                  textShadow: "0 2px 14px rgba(0,0,0,0.55)",
                }}
              >
                {room.name}
              </div>
            </div>
          ) : null}
          {caption ? (
            <div
              style={{
                ...text(vertical ? width * 0.04 : width * 0.02),
                marginTop: 18,
                lineHeight: 1.3,
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {caption}
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}

      {/* Always shown for AI clips; there is no switch to hide it. */}
      {room.method === "ai-transition" ? (
        <Tag side="right" vertical={vertical}>
          KI-generierter Übergang
        </Tag>
      ) : null}
    </AbsoluteFill>
  );
};

const BrandCard: React.FC<{
  title: string;
  subtitle?: string;
  vertical: boolean;
}> = ({ title, subtitle, vertical }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const opacity = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#151515",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: vertical ? 34 : 26,
        padding: 80,
        opacity,
      }}
    >
      <div
        style={{
          ...text(vertical ? width * 0.05 : width * 0.026),
          color: GOLD,
          letterSpacing: "0.42em",
          marginRight: "-0.42em",
        }}
      >
        VILLANYA
      </div>
      <div style={{ width: vertical ? 120 : 160, height: 1, backgroundColor: GOLD }} />
      <div
        style={{
          ...text(vertical ? width * 0.085 : width * 0.046),
          letterSpacing: "0.04em",
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            ...text(vertical ? width * 0.04 : width * 0.021),
            color: "rgba(255,255,255,0.8)",
            letterSpacing: "0.12em",
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Shown instead of a video when no clips are configured (e.g. in the Studio). */
const Placeholder: React.FC<{ vertical: boolean }> = ({ vertical }) => (
  <BrandCard
    title="Keine Clips konfiguriert"
    subtitle="Props mit --props=walkthrough/<datei>.json übergeben"
    vertical={vertical}
  />
);

export const Walkthrough: React.FC<WalkthroughProps> = (props) => {
  const vertical = props.orientation === "vertical";
  if (props.rooms.length === 0) return <Placeholder vertical={vertical} />;

  const { segments } = buildTimeline(props);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <TransitionSeries>
        {segments.map((segment, i) => {
          const t = segment.transitionAfter;
          const hasNext = i < segments.length - 1;
          return (
            <React.Fragment key={segment.room?.id ?? segment.kind}>
              <TransitionSeries.Sequence
                durationInFrames={segment.frames}
                name={segment.room?.name ?? segment.kind}
              >
                {segment.room ? (
                  <RoomClip room={segment.room} props={props} />
                ) : (
                  <BrandCard
                    title={props.title}
                    subtitle={segment.kind === "endcard" ? props.subtitle : undefined}
                    vertical={vertical}
                  />
                )}
              </TransitionSeries.Sequence>
              {hasNext && t && t.frames > 0 && t.type !== "cut" ? (
                <TransitionSeries.Transition
                  presentation={presentationFor(t.type)}
                  timing={linearTiming({ durationInFrames: t.frames })}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {props.music ? (
        <Audio src={staticFile(props.music.src)} volume={props.music.volume ?? 0.35} loop />
      ) : null}

      {/* Drafts are stamped on every frame so they cannot be mistaken for a release. */}
      {props.mode === "draft" ? (
        <Tag side="left" vertical={vertical} gold>
          ENTWURF · nicht freigegeben
        </Tag>
      ) : null}
    </AbsoluteFill>
  );
};
