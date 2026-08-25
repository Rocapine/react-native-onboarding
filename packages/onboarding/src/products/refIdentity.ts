import type { ProductRef } from "./types";

/**
 * The content identity of a `ProductRef` — the ONE place its fields are
 * enumerated.
 *
 * Two callers depend on this and neither fails loudly when it is wrong:
 * `useProducts`'s `refsKey` (a stale identity means a changed ref never
 * refetches) and `collectProductRefs`'s dedup (a colliding identity means two
 * distinct refs collapse into one and the second is never resolved). Both used
 * to hand-roll the same template string, so adding a field to `ProductRef`
 * meant remembering two places. Add new fields HERE and both callers follow.
 *
 * A unit separator (U+001F) rather than a printable one: a Play id is
 * `productId:basePlanId` and a Payment Link is a URL, both of which can
 * contain almost any printable character, so a printable separator risks
 * `{ios:"a",android:"b"}` and `{ios:"a|b"}` hashing alike.
 */
const SEP = "\u001F";

export const productRefIdentity = (ref: ProductRef): string =>
  [
    ref.key,
    ref.ios ?? "",
    ref.android ?? "",
    ref.compareTo ?? "",
    ref.stripe?.paymentLink ?? "",
    ref.stripe?.priceId ?? "",
    ref.stripe?.amount ?? "",
    ref.stripe?.currency ?? "",
    ref.stripe?.periodIso ?? "",
    ref.stripe?.trialDays ?? "",
  ].join(SEP);
