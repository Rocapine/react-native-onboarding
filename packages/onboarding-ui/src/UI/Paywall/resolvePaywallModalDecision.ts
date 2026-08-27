/** What `PaywallHost`'s Modal should do for the current `activePaywall`. */
export type PaywallModalDecision<TElements, TScreen = unknown> =
  | { type: "hidden" }
  /**
   * `error` is whatever the injected parser reported (a `ZodError` in the real
   * caller). Carried rather than discarded because a paywall that fails to
   * validate can never render, and the parser has already computed exactly
   * which prop is wrong — dropping it left the host resolving a bare "error"
   * and the failure only identifiable by elimination.
   */
  | { type: "parse-error"; error: unknown }
  | { type: "show"; elements: TElements }
  /**
   * A `renderMode: "custom"` paywall whose `customScreenId` the host DID
   * register. `payload` is normalized here (never `undefined`) so the screen's
   * one reason to exist always has a shape.
   */
  | { type: "show-custom"; Screen: TScreen; customScreenId: string; payload: CustomPayload }
  /**
   * A `renderMode: "custom"` paywall naming a screen this host did not
   * register — or naming none at all. Its own decision, not a `parse-error`:
   * that one is a CMS data bug for the author to fix, this is a host wiring
   * bug for the app to fix. `customScreenId` is carried (possibly `""`) so the
   * host can name it in the log alongside the ids that ARE registered.
   */
  | { type: "unknown-custom-screen"; customScreenId: string };

/** Mirrors the headless `PaywallCustomPayload`, restated to keep this module import-free of it. */
type CustomPayload = Record<string, { ios?: string; android?: string }>;

/** The custom-screen fields this decision reads off the active paywall. */
type CustomScreenFields = {
  renderMode?: "elements" | "custom" | null;
  customScreenId?: string | null;
  customPayload?: CustomPayload | null;
};

/**
 * Decides whether `PaywallHost` should open the Modal, and with what, given a
 * `parse` function that validates `paywall.elements` — dependency-injected so
 * this stays a pure, importable unit: the real caller passes
 * `ScreenElementsSchema.safeParse`, which pulls in every element renderer and
 * therefore `react-native`; this module does not, so it can be unit-tested
 * under plain Node (there is no rendering harness in this package).
 *
 * Finding 2, 2026-08-17 final review: `PaywallContent` used to parse with
 * `ScreenElementsSchema.parse(...)` DURING RENDER, inside `withErrorBoundary`.
 * A bad payload made the boundary catch and render its fallback — which has
 * no interactive control at all — inside a `presentationStyle="fullScreen"`,
 * `transparent={false}` Modal. On iOS there was then no way out but
 * force-quit, and the pending `present()` promise never settled. The fix:
 * parse OUTSIDE the boundary, here, before the Modal ever opens. A parse
 * failure is `"parse-error"`: `PaywallHost` resolves
 * `complete({status:"error"})` and never shows the Modal at all — exactly
 * what `PresentResult.error` exists for. The boundary stays around
 * `PaywallContent` for genuine render-time crashes elsewhere in the tree,
 * which this decision does not and cannot cover.
 *
 * `customScreens` adds the `renderMode: "custom"` fork. Two properties of it
 * are load-bearing:
 *
 *  - **The parser is not called at all in custom mode**, not merely ignored.
 *    An author who flips a paywall to custom may leave an element tree behind
 *    (the studio deliberately does not destroy it, so flipping back restores
 *    it), and that tree must not be parsed or rendered on the way past.
 *  - **An absent `renderMode` means `"elements"`.** A device on a new SDK can
 *    be talking to an older `get-paywalls` that never sends the field, and on
 *    that pairing every existing paywall must keep working exactly as before.
 */
export const resolvePaywallModalDecision = <
  TPaywall extends { elements: unknown } & CustomScreenFields,
  TElements,
  TScreen = unknown,
>(
  activePaywall: TPaywall | null,
  parse: (
    elements: unknown
  ) => { success: true; data: TElements } | { success: false; error?: unknown },
  customScreens?: Record<string, TScreen>
): PaywallModalDecision<TElements, TScreen> => {
  if (!activePaywall) return { type: "hidden" };

  if (activePaywall.renderMode === "custom") {
    // Trimmed before lookup: the studio strips whitespace as you type, but the
    // column is free text and an id that round-tripped through anything else
    // should still match its registration rather than mysteriously not.
    const customScreenId = (activePaywall.customScreenId ?? "").trim();
    const Screen = customScreenId ? customScreens?.[customScreenId] : undefined;
    if (!Screen) return { type: "unknown-custom-screen", customScreenId };
    return {
      type: "show-custom",
      Screen,
      customScreenId,
      // Normalized here rather than in the component: one place, and the
      // screen's prop type can then promise a real map.
      payload: activePaywall.customPayload ?? {},
    };
  }

  const result = parse(activePaywall.elements);
  return result.success
    ? { type: "show", elements: result.data }
    : { type: "parse-error", error: result.error };
};

/** One concrete validation failure, with its path accumulated from the root. */
type ParseLeaf = { path: Array<string | number>; message: string };

/**
 * Flattens a Zod issue tree into leaf failures with cumulative paths.
 *
 * Necessary because the element schema is a 26-member discriminated union of
 * unions: the top-level issue is always `invalid_union` at the array index with
 * the message "Invalid input", and the branch that actually explains the
 * failure sits several levels down. Reporting only the top level prints
 * `0: Invalid input` — which is what the discarded-error bug already gave us,
 * so recursing is the entire point. Zod v4 nests branches under `errors`
 * (`Issue[][]`); v3 used `unionErrors` (`ZodError[]`). Both are handled since
 * the parser is dependency-injected and its zod version is not ours to assume.
 */
const flattenParseIssues = (
  issues: unknown[],
  prefix: Array<string | number>,
  out: ParseLeaf[]
): void => {
  for (const raw of issues) {
    const issue = (raw ?? {}) as {
      path?: unknown;
      message?: unknown;
      errors?: unknown;
      unionErrors?: unknown;
    };
    const path = [...prefix, ...(Array.isArray(issue.path) ? issue.path : [])];
    const branches = issue.errors ?? issue.unionErrors;
    if (Array.isArray(branches)) {
      for (const branch of branches) {
        // v4: a plain Issue[]. v3: a ZodError exposing `.issues`.
        const branchIssues = Array.isArray(branch)
          ? branch
          : ((branch as { issues?: unknown })?.issues as unknown[] | undefined);
        if (Array.isArray(branchIssues)) flattenParseIssues(branchIssues, path, out);
      }
      continue;
    }
    out.push({ path, message: String(issue.message ?? "invalid") });
  }
};

/** Reads the value at a flattened issue path, for reporting what was actually authored. */
const valueAtPath = (root: unknown, path: Array<string | number>): unknown => {
  let node: unknown = root;
  for (const key of path) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[key];
  }
  return node;
};

/**
 * Renders a parse failure as one log line naming the offending paths, and the
 * values actually authored there when `elements` is supplied.
 *
 * Pure and exported so it can be unit-tested — `PaywallHost` cannot be
 * rendered in this package (no render harness), and the whole value of this
 * message is that it is precise, so it is worth a test of its own.
 *
 * Reports the DEEPEST distinct paths rather than every leaf: a 26-variant union
 * produces hundreds of leaves, most of them just "this isn't a YStack" from
 * variants that never matched the discriminator. The failure that matters is
 * the one the parser got furthest into, so depth is the ranking signal.
 *
 * Defensive about its input on purpose: the parser is dependency-injected, so
 * `error` is only a `ZodError` by convention, and a diagnostic that throws
 * while reporting a diagnostic would reinstate exactly the silence it exists
 * to break.
 */
export const describePaywallParseError = (error: unknown, elements?: unknown): string => {
  const issues = (error as { issues?: unknown })?.issues;
  if (!Array.isArray(issues) || issues.length === 0) {
    // No recognisable issue list — say what we have rather than nothing.
    return typeof error === "string" ? error : JSON.stringify(error ?? null);
  }
  const leaves: ParseLeaf[] = [];
  flattenParseIssues(issues, [], leaves);
  if (leaves.length === 0) return JSON.stringify(error ?? null);

  const byPath = new Map<string, ParseLeaf>();
  for (const leaf of leaves) {
    const key = leaf.path.join(".");
    if (!byPath.has(key)) byPath.set(key, leaf);
  }
  // Ranking, in order:
  //  1. paths the author ACTUALLY WROTE a value at. This is the signal that
  //     separates "your data is wrong" from "you are not a Text element": a
  //     26-variant union complains that every non-matching variant's required
  //     props are missing, and those complaints all point at props that do not
  //     exist in the authored object. Depth alone ranks them equal to the real
  //     failure and drowns it — the actual production case surfaced
  //     `props.content/url/intensity: expected string, received undefined`
  //     while the true cause, an invalid `props.variant`, sat at the same depth.
  //  2. then deeper paths, as the variant the parser got furthest into.
  const authored = (leaf: ParseLeaf): boolean =>
    elements !== undefined && valueAtPath(elements, leaf.path) !== undefined;
  const ranked = [...byPath.values()]
    .sort((a, b) => {
      const byAuthored = Number(authored(b)) - Number(authored(a));
      return byAuthored !== 0 ? byAuthored : b.path.length - a.path.length;
    })
    .slice(0, 3);

  return ranked
    .map((leaf) => {
      const where = leaf.path.length > 0 ? leaf.path.join(".") : "(root)";
      if (elements === undefined) return `${where}: ${leaf.message}`;
      const actual = valueAtPath(elements, leaf.path);
      return actual === undefined
        ? `${where}: ${leaf.message}`
        : `${where}: ${leaf.message} (authored value: ${JSON.stringify(actual)})`;
    })
    .join("; ");
};
