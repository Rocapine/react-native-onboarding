import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";
import type { UIElement } from "../types";
import { IN_FLIGHT_ANY_KEY } from "../inFlight";

/**
 * Pure helpers behind the `Repeat` element, kept free of any react-native import
 * so they can be unit-tested directly (the vitest project runs in a node
 * environment — see vitest.config.ts).
 */

export type RepeatRow = Record<string, string | number | boolean>;

/**
 * Clone a template subtree, suffixing every id.
 *
 * N materializations of one template would otherwise all claim the same ids.
 * React keys come from `element.id`, so duplicates break reconciliation; they
 * would also make any id-addressed diagnostic (or a studio jump-to-element)
 * ambiguous. Mirrors how the studio's own `Variant` expansion suffixes ids with
 * the case id, so both sides produce the same shape of materialized tree.
 */
export const suffixIds = (elements: UIElement[], suffix: string): UIElement[] =>
  elements.map((el) => {
    const withChildren = el as UIElement & { children?: UIElement[] };
    const next = { ...el, id: `${el.id}__${suffix}` } as UIElement & { children?: UIElement[] };
    if (Array.isArray(withChildren.children)) {
      next.children = suffixIds(withChildren.children, suffix);
    }
    return next as UIElement;
  });

/**
 * The id suffix / React key for each row: the `keyField` value when it resolves,
 * else the row index. Prefer a keyField — ids stay meaningful in diagnostics and
 * identity survives a reordering of `data`.
 */
export const buildRowKeys = (rows: RepeatRow[], keyField?: string): string[] =>
  rows.map((row, i) => {
    const raw = keyField ? row[keyField] : undefined;
    return raw != null ? String(raw) : String(i);
  });

/**
 * The row's fields as variable entries, namespaced under `scope`. `<scope>.index`
 * is always added so a template can react to its own position.
 */
export const buildRowEntries = (
  row: RepeatRow,
  index: number,
  scope: string
): Record<string, ComposableVariableEntry> => {
  const entries: Record<string, ComposableVariableEntry> = {};
  for (const [field, value] of Object.entries(row)) {
    entries[`${scope}.${field}`] = { value: String(value) };
  }
  entries[`${scope}.index`] = { value: String(index) };
  return entries;
};

/**
 * Flat (primitive) form of the same scope, for `renderWhen` / `evaluateCondition`.
 * Values keep their original type here rather than being stringified, so a
 * numeric row field still compares numerically.
 */
export const buildRowFlat = (
  row: RepeatRow,
  index: number,
  scope: string
): Record<string, unknown> => {
  const flat: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(row)) {
    flat[`${scope}.${field}`] = value;
  }
  flat[`${scope}.index`] = index;
  return flat;
};

/**
 * Alias this row's own `actions.pending.<suffixedId>` keys back to the TEMPLATE
 * id (#191, review round 1, finding 9).
 *
 * `suffixIds` rewrites `row-cta` to `row-cta__yearly`, so the runtime publishes
 * the pending key under an id the author never wrote and cannot spell:
 * `evaluateCondition` looks its left-hand side up verbatim (only the right-hand
 * side interpolates `{{…}}`), and the row scope otherwise exposes `item.*`
 * only. Without this, `disabledWhen: { variable: "actions.pending.row-cta" }`
 * inside a `Repeat` was dead — the CTA never disabled, the row spinner never
 * rendered — and the screen-wide `actions.pending` was true for every row at
 * once, showing the pending state on all of them.
 *
 * Scoped to the row: another row's suffix does not match, so each row sees only
 * its own. The screen-wide key is left alone (an element literally named so that
 * stripping its suffix collides with it is skipped rather than allowed to
 * overwrite the flag).
 */
export const withRowPendingAliases = <T>(
  variables: Record<string, T>,
  rowKey: string
): Record<string, T> => {
  const suffix = `__${rowKey}`;
  const prefix = `${IN_FLIGHT_ANY_KEY}.`;
  let out: Record<string, T> | undefined;
  for (const [key, value] of Object.entries(variables)) {
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const templateKey = key.slice(0, key.length - suffix.length);
    if (templateKey === prefix.slice(0, -1) || templateKey === prefix) continue;
    out ??= { ...variables };
    out[templateKey] = value;
  }
  return out ?? variables;
};
