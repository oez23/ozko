import React from "react";
import { DEFAULT_TOUR_HOSTS, validateTourUrl } from "./tourUrl.ts";

/**
 * Embeds an external interactive tour on a web page. Not a Remotion composition:
 * tours are interactive and cannot be rendered into the MP4 outputs.
 */
export const InteractiveTour: React.FC<{
  url: string;
  title: string;
  allowedHosts?: readonly string[];
}> = ({ url, title, allowedHosts = DEFAULT_TOUR_HOSTS }) => {
  const result = validateTourUrl(url, allowedHosts);
  if (!result.ok) {
    return <p role="alert">Tour kann nicht angezeigt werden: {result.reason}</p>;
  }
  return (
    // Deliberately a plain iframe: this viewer runs on a web page, not in a Remotion render.
    // eslint-disable-next-line @remotion/warn-native-media-tag
    <iframe
      src={result.url}
      title={title}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups"
      allow="fullscreen; xr-spatial-tracking"
      style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
    />
  );
};
