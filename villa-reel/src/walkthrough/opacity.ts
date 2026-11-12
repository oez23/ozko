/** A length-aware envelope, including clips shorter than the normal fades. */
export const labelOpacity = (frame: number, durationInFrames: number): number => {
  const fadeFrames = Math.max(1, Math.min(16, Math.floor(durationInFrames / 3)));
  const fadeIn = frame / fadeFrames;
  const fadeOut = (durationInFrames - 1 - frame) / fadeFrames;
  return Math.max(0, Math.min(1, fadeIn, fadeOut));
};
