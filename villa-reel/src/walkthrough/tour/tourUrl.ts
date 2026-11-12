// URL check for embedded interactive tours (Matterport, 3DVista, ...).
// A tour is a web page, not a video file: it is shown in a viewer, never rendered to MP4.

/** Hosts that may be embedded. Self-hosted 3DVista tours: add the customer's host here. */
export const DEFAULT_TOUR_HOSTS: readonly string[] = ["my.matterport.com"];

export type TourUrlResult =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string };

export const validateTourUrl = (
  input: string,
  allowedHosts: readonly string[] = DEFAULT_TOUR_HOSTS,
): TourUrlResult => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "keine gültige URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "nur https erlaubt" };
  if (url.username || url.password) return { ok: false, reason: "Zugangsdaten in der URL" };
  if (url.port) return { ok: false, reason: "abweichender Port" };
  // Exact host match only: no subdomain wildcards, no suffix tricks.
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.includes(host)) {
    return { ok: false, reason: `Host nicht freigegeben: ${host}` };
  }
  return { ok: true, url: url.toString(), host };
};
