/** What `PaywallHost`'s Modal should do for the current `activePaywall`. */
export type PaywallModalDecision<TElements> =
  | { type: "hidden" }
  | { type: "parse-error" }
  | { type: "show"; elements: TElements };

/**
 * Decides whether `PaywallHost` should open the Modal, and with what, given a
 * `parse` function that validates `paywall.elements` — dependency-injected so
 * this stays a pure, importable unit: the real caller passes
 * `ScreenElementsSchema.safeParse`, which pulls in every element renderer and
 * therefore `react-native`; this module does not, so it can be unit-tested
 * under plain Node (there is no rendering harness in this package).
 *
 * Finding 2, 2026-08-17 final review: `PaywallContent` used to parse with
 * `ScreenElementsSchema.parse(...)` DURING RENDER, inside `withErrorBoundary`.
 * A bad payload made the boundary catch and render its fallback — which has
 * no interactive control at all — inside a `presentationStyle="fullScreen"`,
 * `transparent={false}` Modal. On iOS there was then no way out but
 * force-quit, and the pending `present()` promise never settled. The fix:
 * parse OUTSIDE the boundary, here, before the Modal ever opens. A parse
 * failure is `"parse-error"`: `PaywallHost` resolves
 * `complete({status:"error"})` and never shows the Modal at all — exactly
 * what `PresentResult.error` exists for. The boundary stays around
 * `PaywallContent` for genuine render-time crashes elsewhere in the tree,
 * which this decision does not and cannot cover.
 */
export const resolvePaywallModalDecision = <TPaywall extends { elements: unknown }, TElements>(
  activePaywall: TPaywall | null,
  parse: (elements: unknown) => { success: true; data: TElements } | { success: false }
): PaywallModalDecision<TElements> => {
  if (!activePaywall) return { type: "hidden" };
  const result = parse(activePaywall.elements);
  return result.success ? { type: "show", elements: result.data } : { type: "parse-error" };
};
