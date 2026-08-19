import { z } from "zod";

/**
 * Materializes its `children` (the template) once per row of `data`.
 *
 * Solves the duplicated-subtree problem: a screen with one card design and six
 * cards, or one reveal design and thirteen zodiac signs, otherwise needs the
 * subtree copy-pasted N times, and every copy or style change becomes an N-fold
 * edit. That duplication has already produced real drift in shipped screens.
 *
 * **Repeat plus a per-row gate is a switch**, so there is no separate `Match`
 * element: give the template's root a `renderWhen` of
 * `{ variable: "item.sign", operator: "eq", value: "{{zodiacSign}}" }`-style
 * shape and exactly one row renders. Iterate-and-show-all and
 * iterate-and-show-one are the same primitive.
 *
 * ## Scope
 *
 * Each row's fields are exposed to that row's subtree under the `as` prefix
 * (default `item`), so `{{item.title}}` interpolates and
 * `{ variable: "item.sign", ... }` gates. `item.index` is always present.
 *
 * The scope reaches BOTH render-time reads (`{{var}}` interpolation,
 * `renderWhen`) and press-time reads (a `setVariable` action with
 * `valueMode: "expression"` referencing `{{item.id}}`), which is what lets a
 * repeated card write its own row's value when tapped. Without the press-time
 * half a repeated grid could be drawn but not answered.
 *
 * Scoped values are READ-ONLY. Nothing writes back into a row; an interactive
 * child still writes to the ordinary variable store, and because the template is
 * shared, every row's child writes the SAME variable name. That is usually what
 * you want for single-select (the row distinguishes itself through the *value*
 * it writes, not the variable it writes to).
 *
 * ## Data lives in the payload
 *
 * `data` is authored in the step, not sourced from a variable holding JSON. That
 * is deliberate: it keeps copy and asset URLs in the studio where designers and
 * the translation pipeline are. Rows sourced from the app would move product copy
 * into the binary, where a typo fix needs a store release and i18n never sees it.
 *
 * For the same reason, a translatable string in a row carries its own literal
 * i18n key (`{ sign: "aries", titleKey: "zodiac_aries_title" }`) rather than a
 * derived one. Key coverage is computed by scanning payloads for *literal* key
 * strings, so a computed key (`"zodiac_{{item.sign}}_title"`) would make the
 * scanner find nothing, report the screen fully translated, and ship untranslated
 * rows. Literal keys per row keep that machinery working untouched.
 *
 * ## Layout
 *
 * Repeat renders no view of its own — the materialized rows become direct
 * children of whatever contains the Repeat, so the parent's `gap`, direction and
 * alignment apply per row exactly as if the rows had been hand-written. Put a
 * Repeat inside a `YStack`/`XStack`/`ZStack` and lay the rows out there.
 *
 * This is why the props below do NOT extend `BaseBoxProps`: with no view to style,
 * box props would silently do nothing.
 */
export type RepeatElementProps = {
  /**
   * One record per materialization. Flat scalars only — nested objects are not
   * addressable by `{{item.x}}` and are rejected.
   */
  data: Array<Record<string, string | number | boolean>>;
  /** Prefix the row's fields are exposed under. Default `"item"`. */
  as?: string;
  /**
   * Row field used to build each materialized element's id suffix and React key
   * (`card` → `card__aries`). Falls back to the row index when unset or missing.
   * Prefer setting it: ids stay meaningful in diagnostics, and identity survives
   * a reordering of `data`.
   */
  keyField?: string;
};

export const RepeatElementPropsSchema = z.object({
  data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
  as: z.string().min(1).optional(),
  keyField: z.string().min(1).optional(),
});
