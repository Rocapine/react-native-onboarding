import { UIElementSchema } from "./types";

/**
 * Detection for keys placed at an element's TOP LEVEL that the schema doesn't
 * know about.
 *
 * Zod strips unrecognized keys instead of rejecting them, which makes a
 * misplaced prop completely silent: the element still parses, still renders, and
 * the prop simply does nothing. The common case is a `BaseBoxProp` written one
 * level too high — `animation` next to `type`/`props` rather than inside `props`
 * — which reads as correct and is dead. One live onboarding had six such
 * elements before anyone noticed.
 *
 * This is deliberately NON-FATAL and separate from parsing. Making the element
 * schema `.strict()` would turn every already-published payload carrying a stray
 * key into a hard parse failure, taking down whole screens to report a no-op —
 * strictly worse than the bug. So this reports; it never rejects.
 *
 * The allowed key sets are derived from `UIElementSchema` itself at runtime
 * rather than hardcoded, so they cannot drift as elements gain props.
 */
export type UnknownElementKey = {
  /** Location in the tree, e.g. `elements[0].children[2]`. */
  path: string;
  elementId: string;
  elementType: string;
  /** The unrecognized top-level key. */
  key: string;
  /**
   * Which of three quite different mistakes this is. They need different advice:
   *
   * • `unknown`   — not a valid key anywhere on this element. Probably a typo or
   *                 a prop from a different element type.
   * • `misplaced` — a valid prop for this element, and `props` does NOT have it.
   *                 Almost certainly meant to be inside `props`.
   * • `shadowed`  — a valid prop, and `props` ALREADY has it. The top-level copy
   *                 is inert and the `props` one is what runs. This is the nastiest
   *                 of the three: telling someone "did you mean props.animation?"
   *                 is wrong here, because props.animation is right there. The real
   *                 risk is editing the dead copy, seeing no change, and concluding
   *                 the renderer is broken.
   */
  kind: "unknown" | "misplaced" | "shadowed";
  /** For `misplaced`/`shadowed`: where the value belongs, or already lives. */
  suggestion?: string;
  /**
   * `shadowed` only — whether the live `props` value actually DIFFERS from the
   * dead top-level copy. Two identical copies are harmless cruft; two that
   * disagree are a trap, and only the disagreement is worth alarming about.
   */
  conflicts?: boolean;
};

type ElementKeySets = { topLevel: Set<string>; props: Set<string> };

const zdef = (schema: any): any => schema?._zod?.def ?? schema?._def;

// Every string literal a `type` field can hold. Most variants use
// `z.literal("X")`, but the stack variant is `z.union([literal, literal])`.
const literalsOf = (schema: any): string[] => {
  const def = zdef(schema);
  if (!def) return [];
  if (def.type === "literal") {
    const values = def.values ?? (def.value !== undefined ? [def.value] : []);
    return values.filter((v: unknown): v is string => typeof v === "string");
  }
  if (def.type === "union") return (def.options ?? []).flatMap(literalsOf);
  return [];
};

let registry: Map<string, ElementKeySets> | null = null;

// Built once, lazily. Any shape change in zod's internals degrades to "no
// registry", which makes the whole feature a no-op rather than a crash — this is
// a diagnostic, it must never be able to break rendering.
const getRegistry = (): Map<string, ElementKeySets> => {
  if (registry) return registry;
  const built = new Map<string, ElementKeySets>();
  try {
    const lazyDef = zdef(UIElementSchema);
    const union = typeof lazyDef?.getter === "function" ? lazyDef.getter() : UIElementSchema;
    const options = zdef(union)?.options ?? [];
    for (const option of options) {
      const shape = zdef(option)?.shape;
      if (!shape) continue;
      const propsShape = zdef(shape.props)?.shape ?? {};
      const keySets: ElementKeySets = {
        topLevel: new Set(Object.keys(shape)),
        props: new Set(Object.keys(propsShape)),
      };
      for (const typeName of literalsOf(shape.type)) built.set(typeName, keySets);
    }
  } catch {
    // fall through to whatever was built before the failure
  }
  registry = built;
  return registry;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Structural comparison good enough to tell "same value duplicated" from "two
// values that disagree". Falls back to "assume they differ" if the value can't be
// serialized (circular / exotic), since a false alarm is cheaper here than
// staying silent about a real conflict.
const valuesDiffer = (a: unknown, b: unknown): boolean => {
  if (a === b) return false;
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
};

/**
 * Walk an element tree and report unrecognized top-level keys.
 *
 * Elements whose `type` isn't in the schema are skipped rather than reported —
 * an unknown element type is a parse error the union already surfaces properly,
 * and guessing its key set would produce noise.
 */
export const collectUnknownElementKeys = (
  elements: unknown,
  basePath = "elements"
): UnknownElementKey[] => {
  const known = getRegistry();
  if (known.size === 0 || !Array.isArray(elements)) return [];

  const found: UnknownElementKey[] = [];

  const visit = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    const elementType = typeof node.type === "string" ? node.type : undefined;
    const keySets = elementType ? known.get(elementType) : undefined;

    if (keySets) {
      const props = isRecord(node.props) ? node.props : undefined;
      for (const key of Object.keys(node)) {
        if (keySets.topLevel.has(key)) continue;

        const isValidProp = keySets.props.has(key);
        const alreadyInProps = isValidProp && props !== undefined && key in props;

        found.push({
          path,
          elementId: typeof node.id === "string" ? node.id : "(no id)",
          elementType: elementType!,
          key,
          kind: !isValidProp ? "unknown" : alreadyInProps ? "shadowed" : "misplaced",
          suggestion: isValidProp ? `props.${key}` : undefined,
          conflicts: alreadyInProps ? valuesDiffer(node[key], props![key]) : undefined,
        });
      }
    }

    // Recurse regardless of whether this node was recognized, so a stray key
    // nested under an unknown-typed parent is still found.
    if (Array.isArray(node.children)) {
      node.children.forEach((child, i) => visit(child, `${path}.children[${i}]`));
    }
  };

  elements.forEach((element, i) => visit(element, `${basePath}[${i}]`));
  return found;
};

/**
 * Same check across a whole steps array, for callers holding a fetched
 * onboarding rather than one screen's elements. Only steps carrying
 * `payload.elements` are inspected; other step types have no element tree.
 */
export const collectUnknownKeysInSteps = (steps: unknown): UnknownElementKey[] => {
  if (!Array.isArray(steps)) return [];
  return steps.flatMap((step, i) => {
    if (!isRecord(step)) return [];
    const payload = step.payload;
    if (!isRecord(payload) || !Array.isArray(payload.elements)) return [];
    const stepId = typeof step.id === "string" ? step.id : String(i);
    return collectUnknownElementKeys(payload.elements, `step[${stepId}].elements`);
  });
};

/** Human-readable report; returns "" when there is nothing to say. */
export const formatUnknownElementKeys = (found: UnknownElementKey[]): string => {
  if (found.length === 0) return "";
  const lines = found.map((f) => {
    const where = `${f.path} (${f.elementType} "${f.elementId}")`;
    if (f.kind === "shadowed") {
      // Do NOT say "did you mean props.X?" here — props.X is already there. The
      // useful warning is which copy wins, because the trap is editing the dead
      // one and concluding the renderer is broken.
      return f.conflicts
        ? `  • ${where}: "${f.key}" is ignored — ${f.suggestion} is ALSO set, to a ` +
          `different value, and that is the one taking effect. Editing this ` +
          `top-level copy will do nothing; delete it.`
        : `  • ${where}: "${f.key}" is ignored — ${f.suggestion} is already set to the ` +
          `same value and is the one taking effect. Delete this top-level copy.`;
    }
    if (f.kind === "misplaced") {
      return `  • ${where}: "${f.key}" is not a top-level key — did you mean ${f.suggestion}?`;
    }
    return `  • ${where}: unrecognized top-level key "${f.key}"`;
  });
  return (
    `[onboarding] ${found.length} unrecognized top-level ` +
    `${found.length === 1 ? "key" : "keys"} on elements. These are silently ` +
    `dropped when the payload is parsed, so they have no effect:\n` +
    lines.join("\n")
  );
};
