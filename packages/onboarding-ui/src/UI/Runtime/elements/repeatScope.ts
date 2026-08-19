import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";
import type { UIElement } from "../types";

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
