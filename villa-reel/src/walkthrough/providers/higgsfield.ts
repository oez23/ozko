import { basePrepare, type ImageToVideoProvider } from "./types.ts";

// Higgsfield image-to-video. Not connected: no transport ships with this repo.
// Capabilities below are assumptions to confirm against the current Higgsfield docs.
export const higgsfield: ImageToVideoProvider = {
  id: "higgsfield",
  label: "Higgsfield",
  apiKeyEnv: ["HIGGSFIELD_API_KEY"],
  durationsSec: [5],
  supportsEndFrame: true,
  prepare: basePrepare("higgsfield", true),
};
