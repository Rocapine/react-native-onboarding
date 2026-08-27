import { isReservedUserPropertyKey } from "./reserved";
import type { UserProperties, UserPropertyPatch } from "./types";

/**
 * The store's entire mutation logic, as a pure function — so merge semantics,
 * deletion, and every rejection rule are covered by an importable test rather
 * than through AsyncStorage and React.
 *
 * Warnings are RETURNED rather than logged here, so the same rules can be
 * asserted without spying on `console`. The store logs them.
 *
 * Returns the SAME `current` object when nothing changed, so a no-op `set` does
 * not notify subscribers or trigger a refetch — a host calling `set({ plan })`
 * on every render must not re-key the catalog query each time.
 */
export const applyUserPropertyPatch = (
  current: UserProperties,
  patch: UserPropertyPatch,
): { next: UserProperties; warnings: string[] } => {
  const warnings: string[] = [];
  const next: UserProperties = { ...current };
  let changed = false;

  for (const key of Object.keys(patch)) {
    if (isReservedUserPropertyKey(key)) {
      warnings.push(
        `[user-properties] Ignoring "${key}" — the SDK puts that name on the ` +
          "request querystring itself, and a duplicate silently breaks the request. " +
          "Rename the property.",
      );
      continue;
    }

    const value = patch[key];

    if (value === null || value === undefined) {
      if (key in next) {
        delete next[key];
        changed = true;
      }
      continue;
    }

    const type = typeof value;
    if (type === "number") {
      if (!Number.isFinite(value)) {
        warnings.push(
          `[user-properties] Ignoring "${key}" — ${String(value)} is not a finite ` +
            'number and would reach the server as "NaN"/"Infinity", matching nothing.',
        );
        continue;
      }
    } else if (type !== "string" && type !== "boolean") {
      warnings.push(
        `[user-properties] Ignoring "${key}" — a user property must be a string, ` +
          `number or boolean, not ${type}. Audience filters compare scalars.`,
      );
      continue;
    }

    if (next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  }

  return { next: changed ? next : current, warnings };
};
