import { basePrepare, type ImageToVideoProvider } from "./types.ts";

// Kling image-to-video. Not connected: no transport ships with this repo.
// Capabilities below are assumptions to confirm against the current Kling docs.
export const kling: ImageToVideoProvider = {
  id: "kling",
  label: "Kling",
  apiKeyEnv: ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"],
  durationsSec: [5, 10],
  supportsEndFrame: true,
  prepare: basePrepare("kling", true),
};
