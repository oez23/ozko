// Shared contract for AI image-to-video providers. Pure, no Remotion imports.
// Adapters describe a job; they never send it themselves. Sending needs an
// explicit approval and a transport supplied by the caller (see submitJob).
import type { WalkthroughRoom } from "../types.ts";

export type ImageToVideoJob = {
  /** Id for the resulting clip, e.g. "wohnzimmer-zu-kueche". */
  id: string;
  fromRoom: string;
  toRoom: string;
  /** Real photos, paths relative to public/. */
  startFrame: string;
  endFrame?: string;
  durationSec: number;
  aspectRatio: "9:16" | "16:9";
};

/** Provider-neutral request. The transport translates it to the provider's API. */
export type ProviderRequest = {
  provider: string;
  prompt: string;
  startFrame: string;
  endFrame?: string;
  durationSec: number;
  aspectRatio: "9:16" | "16:9";
};

export type ImageToVideoProvider = {
  id: string;
  label: string;
  /** Environment variables that hold the credentials. Never put keys in code. */
  apiKeyEnv: string[];
  /** Clip lengths the provider offers, in seconds. Check against current provider docs. */
  durationsSec: number[];
  /** Whether an end frame can be passed. Check against current provider docs. */
  supportsEndFrame: boolean;
  prepare: (job: ImageToVideoJob) => ProviderRequest;
};

export type Transport = (
  request: ProviderRequest,
  credentials: Record<string, string>,
) => Promise<{ jobId: string }>;

/**
 * Prompt shared by all providers: camera move only, nothing added to the property.
 */
export const buildPrompt = (job: ImageToVideoJob): string =>
  [
    `Slow, steady interior camera move through a real property, from "${job.fromRoom}" towards the doorway`,
    job.endFrame ? `and on into "${job.toRoom}", ending exactly on the provided end frame.` : "and stop at the doorway.",
    "Keep walls, doors, windows, furniture and proportions exactly as in the photos.",
    "Do not add rooms, objects, people, text or furniture. No style change, no relighting.",
  ].join(" ");

export const basePrepare =
  (provider: string, supportsEndFrame: boolean) =>
  (job: ImageToVideoJob): ProviderRequest => ({
    provider,
    prompt: buildPrompt(supportsEndFrame ? job : { ...job, endFrame: undefined }),
    startFrame: job.startFrame,
    endFrame: supportsEndFrame ? job.endFrame : undefined,
    durationSec: job.durationSec,
    aspectRatio: job.aspectRatio,
  });

export const isConfigured = (
  provider: ImageToVideoProvider,
  env: Record<string, string | undefined>,
): boolean => provider.apiKeyEnv.every((name) => Boolean(env[name]?.trim()));

/**
 * The only way to send a job. Refuses unless a human approved the paid call
 * for this job, credentials are present and a transport was passed in.
 */
export const submitJob = async (
  provider: ImageToVideoProvider,
  job: ImageToVideoJob,
  options: {
    approvedPaidCall: boolean;
    env: Record<string, string | undefined>;
    transport?: Transport;
  },
): Promise<{ jobId: string; request: ProviderRequest }> => {
  if (options.approvedPaidCall !== true) {
    throw new Error(
      `${provider.label}: kostenpflichtiger Aufruf nicht freigegeben (approvedPaidCall fehlt).`,
    );
  }
  if (!isConfigured(provider, options.env)) {
    throw new Error(
      `${provider.label}: Zugangsdaten fehlen (${provider.apiKeyEnv.join(", ")}).`,
    );
  }
  if (!options.transport) {
    throw new Error(`${provider.label}: kein Transport angebunden.`);
  }
  if (!provider.durationsSec.includes(job.durationSec)) {
    throw new Error(
      `${provider.label}: Dauer ${job.durationSec}s wird nicht angeboten (${provider.durationsSec.join(", ")}).`,
    );
  }
  const request = provider.prepare(job);
  const credentials = Object.fromEntries(
    provider.apiKeyEnv.map((name) => [name, options.env[name] as string]),
  );
  const { jobId } = await options.transport(request, credentials);
  return { jobId, request };
};

/**
 * Turns a downloaded AI clip into a room entry. It always starts unreviewed:
 * a human has to check geometry and the room connection before release.
 */
export const aiClipToRoom = (
  provider: ImageToVideoProvider,
  job: ImageToVideoJob,
  clipSrc: string,
): WalkthroughRoom => ({
  id: job.id,
  name: `${job.fromRoom} → ${job.toRoom}`,
  method: "ai-transition",
  source: { src: clipSrc, projection: "flat" },
  durationSec: job.durationSec,
  verification: "pending",
  ai: {
    provider: provider.id,
    startFrame: job.startFrame,
    endFrame: provider.supportsEndFrame ? job.endFrame : undefined,
    geometryReviewed: false,
    connectionConfirmed: false,
  },
});
