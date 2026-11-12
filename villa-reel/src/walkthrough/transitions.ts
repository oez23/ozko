// Maps the configured transition type to a Remotion presentation.
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionType } from "./types.ts";

type AnyPresentation = TransitionPresentation<Record<string, unknown>>;

/** "cut" has no presentation: the caller simply omits the transition. */
export const presentationFor = (
  type: Exclude<TransitionType, "cut">,
): AnyPresentation => {
  switch (type) {
    case "slide":
      return slide({ direction: "from-right" }) as AnyPresentation;
    case "wipe":
      return wipe({ direction: "from-right" }) as AnyPresentation;
    case "fade":
      return fade() as AnyPresentation;
  }
};
