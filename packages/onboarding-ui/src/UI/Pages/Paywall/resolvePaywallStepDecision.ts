/** What a `Paywall` onboarding step should render for the moment it names. */
export type PaywallStepDecision<TPaywall> =
  /**
   * No `PaywallProvider` above this step. Checked FIRST and reported
   * separately because `EMPTY_PAYWALL_CONTEXT` reports
   * `catalogStatus: "loading"` and nothing will ever arrive — a spinner here
   * would never end.
   */
  | { type: "no-provider" }
  /** A catalog is on its way, or a revalidation may still deliver this moment. */
  | { type: "loading" }
  | { type: "show"; paywall: TPaywall }
  /**
   * The catalog settled and does not contain this moment: a typo, an
   * unpublished paywall, or a moment whose audience waterfall matched nothing
   * for this user.
   */
  | { type: "unknown-moment" };

/**
 * Pure, generic over the paywall shape, and importing NOTHING — so it can be
 * unit-tested under plain Node (there is no render harness in this package),
 * the same reason `resolvePaywallModalDecision` is shaped this way.
 *
 * `catalogStatus` is typed `string` rather than the headless `CatalogStatus`
 * union deliberately: importing that type would couple this module to the
 * headless package for no gain, and the only values this function has an
 * opinion about are `"loading"` and `"revalidating"`.
 *
 * The ORDER of the four branches is the whole subtlety:
 *
 *  1. **no provider** — beats every status, because the status is a lie here.
 *  2. **the moment is present** — the common case, and short-circuiting before
 *     any status reasoning means a paywall already in hand renders during a
 *     background revalidation instead of flashing a spinner.
 *  3. **still in flight** (`loading` / `revalidating`) — wait. A revalidation
 *     may be about to deliver this very moment, and skipping would lose a sale
 *     to a race.
 *  4. otherwise the catalog has settled without it.
 */
export function resolvePaywallStepDecision<TPaywall>(args: {
  isProviderMounted: boolean;
  catalog: { paywalls: Record<string, TPaywall> } | null;
  catalogStatus: string;
  moment: string;
}): PaywallStepDecision<TPaywall> {
  if (!args.isProviderMounted) return { type: "no-provider" };

  // Optional-chained through `paywalls` as well as `catalog`: the catalog is
  // open wire data, and a reader that throws on a malformed payload would take
  // down the onboarding screen rather than degrade.
  const paywall = args.catalog?.paywalls?.[args.moment];
  if (paywall) return { type: "show", paywall };

  if (args.catalogStatus === "loading" || args.catalogStatus === "revalidating") {
    return { type: "loading" };
  }

  return { type: "unknown-moment" };
}
