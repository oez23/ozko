import { higgsfield } from "./higgsfield.ts";
import { kling } from "./kling.ts";
import type { ImageToVideoProvider } from "./types.ts";

/** Add a provider by writing one adapter file and listing it here. */
export const PROVIDERS: Record<string, ImageToVideoProvider> = {
  [higgsfield.id]: higgsfield,
  [kling.id]: kling,
};
