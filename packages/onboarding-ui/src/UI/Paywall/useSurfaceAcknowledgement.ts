import { useCallback, useEffect, useRef } from "react";

/**
 * The paywall host's half of `usePaywallHost().acknowledgePresentation`: it
 * returns the Modal's `onShow`, and acknowledges the one presentation `onShow`
 * cannot report.
 *
 * `onShow` fires when the Modal's `visible` goes false → true, and never when
 * the platform refuses to present (iOS, over another presenting view
 * controller) — which is what makes it the right signal. But when one
 * presentation ends and the next takes the surface in the SAME commit (an
 * `await present("a")` → downsell continuation, or the same moment again),
 * `visible` never leaves `true`, `onShow` never fires again, and the provider
 * would abandon a paywall the user is reading as `host-never-presented`.
 *
 * So a change of `presentation` is acknowledged here when, and only when:
 *  - the Modal is `visible` in this commit, i.e. the host IS rendering the
 *    new presentation (an unregistered custom screen or an element list that
 *    fails to parse hides it, and must never be reported shown), and
 *  - the surface was confirmed by `onShow` and has stayed visible since. A
 *    Modal the platform refused never fired `onShow`, so a successor over it
 *    stays unacknowledged and the provider's wedge recovery still applies.
 *
 * `visible` must be the value passed to the Modal itself. `presentation` is
 * any value whose identity changes once per presentation: `PaywallHost` passes
 * the bound `usePaywallHost().complete`. React-only on purpose (no
 * `react-native` import), so it is tested as is.
 */
export const useSurfaceAcknowledgement = (
  visible: boolean,
  presentation: unknown,
  acknowledge: () => void
): (() => void) => {
  // `onShow` fired for the Modal as it is now, and it has not been hidden since.
  const confirmedRef = useRef(false);
  const lastPresentationRef = useRef(presentation);

  const onShow = useCallback(() => {
    confirmedRef.current = true;
    acknowledge();
  }, [acknowledge]);

  useEffect(() => {
    const swapped = lastPresentationRef.current !== presentation;
    lastPresentationRef.current = presentation;
    if (!visible) {
      // Hidden: the next showing is a new `onShow`, and until then nothing
      // vouches for the surface.
      confirmedRef.current = false;
      return;
    }
    if (swapped && confirmedRef.current) acknowledge();
  }, [visible, presentation, acknowledge]);

  return onShow;
};
