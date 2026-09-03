import { deriveElementTypeNames } from "@rocapine/react-native-onboarding";
import { UIElementSchema } from "./types";

let cached: ReadonlySet<string> | null = null;

/**
 * The element types THIS package can parse and render — the capability the
 * unknown-element strip (#209) must be keyed to.
 *
 * Why not the headless package's `KNOWN_ELEMENT_TYPES`, which is the same list
 * today: because the two are different files in different packages, joined by a
 * peer-dependency RANGE. `package.json` accepts `@rocapine/react-native-onboarding`
 * from a floor well below the current release, and `check-versions.mjs` only
 * holds the two in lockstep at release time — so an installed app can resolve an
 * older headless against a newer UI. Before the strip existed that skew was
 * harmless, because the headless element schema was never consulted at runtime.
 * The strip makes "known" decide what RENDERS, and then keying it on the other
 * package is wrong in both directions:
 *
 *   • headless older → an element this build can draw is stripped, and the
 *     warning claims a type is unknown that this build knows perfectly well;
 *   • headless newer → a type this build's mirror union lacks survives the
 *     strip, `ComposableScreenStepTypeSchema.parse` throws on it anyway, and the
 *     whole screen goes down exactly as before the fix.
 *
 * So this derives from `UIElementSchema` in `./types` — the mirror that actually
 * parses the payload and backs `renderElement`'s dispatch. Only the derivation
 * mechanism is shared with the headless package; the answer is this package's own.
 *
 * Cached: `UIElementSchema` is a module constant, so the walk can only ever
 * produce one answer per process. An EMPTY result means the derivation could not
 * read the schema, which every caller reads as "learn nothing" — nothing is
 * stripped and the parse decides, exactly as it did before the strip existed.
 */
export const getRenderableElementTypes = (): ReadonlySet<string> => {
  if (cached) return cached;
  const derived = deriveElementTypeNames(UIElementSchema);
  cached = derived;
  return derived;
};
