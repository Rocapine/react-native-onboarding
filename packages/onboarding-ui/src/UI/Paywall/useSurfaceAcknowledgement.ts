import { useCallback, useLayoutEffect, useRef } from "react";

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
 *  - the surface was confirmed by an `onShow` received during its CURRENT
 *    visible stretch. A Modal the platform refused never fired `onShow`, so a
 *    successor over it stays unacknowledged and the provider's wedge recovery
 *    still applies.
 *
 * An `onShow` received while the last committed `visible` is `false` is
 * ignored outright: no acknowledgement, no confirmation. iOS emits `onShow`
 * from the present completion with no visibility check, and `PaywallHost`
 * keeps its Modal mounted while hidden, so a paywall that ended before its
 * slide-in finished still delivers its `onShow` late. Counted, it would vouch
 * for whatever is presented next and cancel that one's wedge recovery.
 * Visibility is tracked in a LAYOUT effect, so it is current before any native
 * event for the commit can be handled.
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
  // An `onShow` arrived during the current visible stretch.
  const confirmedRef = useRef(false);
  // The last COMMITTED `visible`, not the one being rendered.
  const visibleRef = useRef(false);
  const lastPresentationRef = useRef(presentation);

  const onShow = useCallback(() => {
    // Late, for a showing that already ended: confirms nothing.
    if (!visibleRef.current) return;
    confirmedRef.current = true;
    acknowledge();
  }, [acknowledge]);

  useLayoutEffect(() => {
    const swapped = lastPresentationRef.current !== presentation;
    const wasVisible = visibleRef.current;
    lastPresentationRef.current = presentation;
    visibleRef.current = visible;
    // Hidden, or a new visible stretch starting: only an `onShow` received
    // from here on vouches for the surface.
    if (!visible || !wasVisible) {
      confirmedRef.current = false;
      return;
    }
    if (swapped && confirmedRef.current) acknowledge();
  }, [visible, presentation, acknowledge]);

  return onShow;
};
