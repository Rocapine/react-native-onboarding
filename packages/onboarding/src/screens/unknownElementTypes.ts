import { getKnownElementTypes } from "./elementTypeRegistry";

/**
 * FORWARD COMPATIBILITY FOR ELEMENT TYPES (issue #209).
 *
 * `UIElementSchema` is a `z.discriminatedUnion("type", …)` over the element
 * types *this build* knows. An element type published after an app shipped
 * therefore missed every branch, and the whole `elements` array failed to
 * parse — one new element type took down the entire screen, in every installed
 * app pinned to an older SDK.
 *
 * That is worse than a blank screen. The ComposableScreen renderer parses with
 * a throwing `.parse` inside `withErrorBoundary`, and that fallback has no
 * interactive control; the host's back chevron lives inside `<ProgressBar>`,
 * gated on the step's `displayProgressHeader`. On a header-off step there is no
 * exit in either direction, because `onContinue` died with the subtree. Real
 * flows have four such steps, including the entry screen and both steps before
 * the paywall.
 *
 * The fix is a linear walk in FRONT of the schema, not a change to it:
 *
 *   • Unknown element `type` → the element is OMITTED, with its subtree, before
 *     the payload is parsed. The rest of the screen renders.
 *   • Anything else → untouched, so a genuine data bug (a `Button` `variant`
 *     outside the enum, a missing `id`) still fails loudly with its exact path.
 *
 * OMIT is the contract, chosen to match what the codebase already does rather
 * than as a new invention: `renderElement` falls through to `return null` for an
 * unrecognized type, `buildAnimation` no-ops an unknown `animation.preset`, and
 * an unknown *step* type already skips with a reason code
 * (`OnboardingPage` → `onContinue("onboarding_screen_not_implemented")`). No
 * placeholder is rendered: a box reading "unsupported" in the middle of an
 * authored layout is worse than the gap it advertises, and the author cannot see
 * it from Studio anyway.
 *
 * WHY NOT WIDEN THE SCHEMA. A non-discriminated union, or a catch-all branch
 * reachable on any miss, is not an option: the discriminator is a deliberate fix
 * for three data-reachable CRASHES (a 512 MB heap OOM on a real 52-node paywall,
 * a `RangeError` thrown from inside zod's own error constructor, and unreadable
 * `invalid_union` output) — see the comment above `UIElementSchema` in
 * `./types.ts` and `__tests__/elementUnionDiscriminator.test.ts`. A fallback
 * branch would also swallow real errors on KNOWN types, turning every CMS data
 * bug into a silently missing element. Stripping first keeps both properties.
 *
 * `ScreenElementsSchema` itself stays STRICT on purpose: authoring- and
 * publish-time validation (Studio, `validate-step-json`, the CLAUDE.md
 * `safeParse` recipe) should keep reporting a typo'd element type as an error.
 * Only the render boundaries strip.
 */

/** One element omitted because this build cannot render its `type`. */
export type UnknownElementType = {
  /** Location in the tree, e.g. `elements[0].children[2]`. */
  path: string;
  elementId: string;
  /** The `type` value no variant of `UIElementSchema` declares. */
  elementType: string;
};

/**
 * Every element `type` this SDK build can parse and render, sorted.
 *
 * The capability list a publish-time gate needs (#209's "capability floor"):
 * derived from `UIElementSchema`, so it is exactly what the installed build
 * supports and cannot be forgotten when an element is added.
 */
export const KNOWN_ELEMENT_TYPES: readonly string[] = [...getKnownElementTypes()].sort();

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * An empty registry means the derivation failed (zod internals moved), not that
 * no element type exists. Read as "learn nothing": every element is kept and the
 * schema decides, exactly as it did before this file existed. The inverse
 * reading would blank every screen in every app.
 */
const resolveKnown = (known?: ReadonlySet<string>): ReadonlySet<string> | null => {
  const set = known ?? getKnownElementTypes();
  return set.size === 0 ? null : set;
};

const isUnknownElement = (node: unknown, known: ReadonlySet<string>): boolean =>
  isRecord(node) && typeof node.type === "string" && !known.has(node.type);

/**
 * Strip every element whose `type` this build does not know from an `elements`
 * array (recursively, through `children`).
 *
 * Pure, and structurally sharing: a payload with nothing unknown comes back as
 * the SAME array reference, so this is free on the overwhelmingly common path
 * and stays stable inside a `useMemo`. Non-array input is returned unchanged for
 * the schema to reject.
 *
 * A node with no `type`, or a non-string one, is KEPT: that is a malformed
 * payload rather than a newer element, and dropping it would hide the real error.
 */
export const dropUnknownElementTypes = <T>(elements: T, known?: ReadonlySet<string>): T => {
  const knownTypes = resolveKnown(known);
  if (knownTypes === null || !Array.isArray(elements)) return elements;
  return dropInArray(elements, knownTypes) as T;
};

const dropInArray = (elements: unknown[], known: ReadonlySet<string>): unknown[] => {
  let changed = false;
  const kept: unknown[] = [];
  for (const node of elements) {
    if (isUnknownElement(node, known)) {
      // The whole subtree goes with it: `renderElement` returns null for an
      // unknown type, so its children never render either.
      changed = true;
      continue;
    }
    const next = dropInNode(node, known);
    if (next !== node) changed = true;
    kept.push(next);
  }
  return changed ? kept : elements;
};

const dropInNode = (node: unknown, known: ReadonlySet<string>): unknown => {
  if (!isRecord(node) || !Array.isArray(node.children)) return node;
  const children = dropInArray(node.children, known);
  return children === node.children ? node : { ...node, children };
};

/**
 * The same strip for a whole step, for callers holding one (the ComposableScreen
 * renderer parses the step, not the array). Steps without `payload.elements` —
 * every non-composable step type — are returned untouched.
 */
export const dropUnknownElementTypesInStep = <T>(step: T, known?: ReadonlySet<string>): T => {
  if (!isRecord(step)) return step;
  const payload = step.payload;
  if (!isRecord(payload) || !Array.isArray(payload.elements)) return step;
  const elements = dropUnknownElementTypes(payload.elements, known);
  if (elements === payload.elements) return step;
  return { ...step, payload: { ...payload, elements } } as T;
};

/**
 * Report — rather than strip — the elements this build cannot render, so a host
 * (and the dev-time payload diagnostic in `OnboardingProvider`) can say what
 * went missing. An unknown parent is reported ONCE: its descendants go with it,
 * and listing them would bury the one fact that matters.
 */
export const collectUnknownElementTypes = (
  elements: unknown,
  basePath = "elements",
  known?: ReadonlySet<string>
): UnknownElementType[] => {
  const knownTypes = resolveKnown(known);
  if (knownTypes === null || !Array.isArray(elements)) return [];

  const found: UnknownElementType[] = [];

  const visit = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    if (isUnknownElement(node, knownTypes)) {
      found.push({
        path,
        elementId: typeof node.id === "string" ? node.id : "(no id)",
        elementType: node.type as string,
      });
      return;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, i) => visit(child, `${path}.children[${i}]`));
    }
  };

  elements.forEach((element, i) => visit(element, `${basePath}[${i}]`));
  return found;
};

/** Same check across a whole steps array, for a caller holding a fetched onboarding. */
export const collectUnknownElementTypesInSteps = (
  steps: unknown,
  known?: ReadonlySet<string>
): UnknownElementType[] => {
  if (!Array.isArray(steps)) return [];
  return steps.flatMap((step, i) => {
    if (!isRecord(step)) return [];
    const payload = step.payload;
    if (!isRecord(payload) || !Array.isArray(payload.elements)) return [];
    const stepId = typeof step.id === "string" ? step.id : String(i);
    return collectUnknownElementTypes(payload.elements, `step[${stepId}].elements`, known);
  });
};

/** Human-readable report; returns "" when there is nothing to say. */
export const formatUnknownElementTypes = (found: UnknownElementType[]): string => {
  if (found.length === 0) return "";
  const lines = found.map(
    (f) => `  • ${f.path} ("${f.elementId}"): element type "${f.elementType}"`
  );
  return (
    `[onboarding] ${found.length} element${found.length === 1 ? "" : "s"} ` +
    `${found.length === 1 ? "uses a type" : "use types"} this SDK build does not know, ` +
    `so ${found.length === 1 ? "it is" : "they are"} omitted and the rest of the screen ` +
    `renders. Upgrade to a newer @rocapine/react-native-onboarding to render ` +
    `${found.length === 1 ? "it" : "them"}:\n${lines.join("\n")}`
  );
};
