import { deriveVariantKeySets, getElementRegistry } from "./elementTypeRegistry";
import { ButtonActionSchema } from "../steps/common.types";

/**
 * Detection for keys the schema doesn't know about — at an element's TOP LEVEL,
 * and on any `ButtonAction` inside `props.actions` / `props.onPress`.
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
 * The allowed key sets are derived from `UIElementSchema` / `ButtonActionSchema`
 * themselves at runtime rather than hardcoded, so they cannot drift as elements
 * gain props or actions gain outcome hooks.
 *
 * The ACTION case (#196) has the same silence and a sharper edge: a misspelled
 * `requestPermission.onDeneid` or `purchase.onSucces` parses clean and leaves an
 * outcome hook that never runs — on a permission screen, a CTA the refusing user
 * cannot get past. Same treatment: report, never reject.
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
  /**
   * Where the key was found. `"element"` (the default) is a key on the element
   * node itself; `"action"` is a key on a `ButtonAction` inside `props.actions`
   * or `props.onPress`, whose `path` points at that action.
   *
   * Actions get their own scope because the two mistakes need different advice:
   * a stray key on an element is usually a prop written one level too high,
   * while a stray key on an action is a misspelled OUTCOME HOOK — a branch of
   * the flow that will never run. `requestPermission.onDeneid` (#196) is the
   * costly one: the payload validates, and the user who refuses the permission
   * has no way off the screen.
   */
  scope?: "element" | "action";
  /** `scope: "action"` only — the action's `type`, e.g. `"requestPermission"`. */
  actionType?: string;
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
 * Variant name → declared key set for the `ButtonAction` union, read off
 * `ButtonActionSchema` itself so a hook added to an action later is covered
 * without touching this file. Built once; EMPTY means "could not tell" and
 * reports nothing, the same degradation the element registry makes.
 */
let actionRegistry: Map<string, ReadonlySet<string>> | null = null;
const getActionRegistry = (): Map<string, ReadonlySet<string>> => {
  if (!actionRegistry) actionRegistry = deriveVariantKeySets(ButtonActionSchema);
  return actionRegistry;
};

/**
 * Report unrecognized keys on every action in one list, recursing into the
 * nested `ButtonAction[]` an outcome hook holds (`purchase.onSuccess`,
 * `requestPermission.onGranted`, …) so a typo two levels down is still found.
 *
 * `"continue"` is a bare string, not an object, and an action whose `type` this
 * build does not know is skipped — guessing its key set would be noise, exactly
 * as for an unknown element type.
 */
const visitActions = (
  actions: unknown,
  path: string,
  element: Record<string, unknown>,
  found: UnknownElementKey[]
): void => {
  if (!Array.isArray(actions)) return;
  const known = getActionRegistry();
  if (known.size === 0) return;

  actions.forEach((action, index) => {
    if (!isRecord(action)) return;
    const actionPath = `${path}[${index}]`;
    const allowed = typeof action.type === "string" ? known.get(action.type) : undefined;
    if (allowed) {
      for (const key of Object.keys(action)) {
        if (allowed.has(key)) continue;
        found.push({
          path: actionPath,
          elementId: typeof element.id === "string" ? element.id : "(no id)",
          elementType: typeof element.type === "string" ? element.type : "(no type)",
          key,
          kind: "unknown",
          scope: "action",
          actionType: action.type as string,
        });
      }
    }
    // Recurse into every nested action list, found by SHAPE rather than by hook
    // name — the same choice `completingActions.ts` makes, so a branch added to
    // an action later needs no change here.
    for (const [key, value] of Object.entries(action)) {
      if (Array.isArray(value)) visitActions(value, `${actionPath}.${key}`, element, found);
    }
  });
};

/**
 * Walk an element tree and report unrecognized top-level keys.
 *
 * Elements whose `type` isn't in the schema are skipped rather than reported —
 * guessing the key set of an element this build has never heard of would produce
 * noise. Unknown element TYPES are their own concern, handled in
 * `./unknownElementTypes.ts`: the render boundaries omit them so a screen
 * published ahead of the installed SDK still renders (#209). Both files derive
 * "known" from the same `./elementTypeRegistry.ts`.
 */
export const collectUnknownElementKeys = (
  elements: unknown,
  basePath = "elements"
): UnknownElementKey[] => {
  const known = getElementRegistry();
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

    // Action lists, on both the `Button`-specific `actions` and the generic
    // `onPress` every element accepts. Walked even on an element type this build
    // does not know: the ACTION union is this package's own, so its key sets are
    // trustworthy regardless of what the element around them is.
    const propsRecord = isRecord(node.props) ? node.props : undefined;
    if (propsRecord) {
      for (const listName of ["actions", "onPress"] as const) {
        visitActions(propsRecord[listName], `${path}.props.${listName}`, node, found);
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
    if (f.scope === "action") {
      // No "did you mean" — the useful fact is that this names a BRANCH of the
      // flow that the parse dropped, so it can never run.
      return (
        `  • ${f.path} (${f.actionType} action on ${f.elementType} "${f.elementId}"): ` +
        `unrecognized key "${f.key}" — dropped when the payload is parsed, so if ` +
        `this was meant to be an outcome hook, that branch never runs.`
      );
    }
    if (f.kind === "misplaced") {
      return `  • ${where}: "${f.key}" is not a top-level key — did you mean ${f.suggestion}?`;
    }
    return `  • ${where}: unrecognized top-level key "${f.key}"`;
  });
  const scopeLabel =
    found.every((f) => f.scope === "action")
      ? "on button actions"
      : found.some((f) => f.scope === "action")
        ? "on elements and their actions"
        : "on elements";
  return (
    `[onboarding] ${found.length} unrecognized ` +
    `${found.length === 1 ? "key" : "keys"} ${scopeLabel}. These are silently ` +
    `dropped when the payload is parsed, so they have no effect:\n` +
    lines.join("\n")
  );
};
