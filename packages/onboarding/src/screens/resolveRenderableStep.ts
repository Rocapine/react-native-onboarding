import { hasCompletingAction } from "./completingActions";
import {
  collectUnknownElementTypes,
  dropUnknownElementTypesInStep,
  type UnknownElementType,
} from "./unknownElementTypes";

/**
 * The whole render-boundary decision for element-type forward compatibility
 * (#209): what to parse, what to log, and whether the renderer must supply its
 * own way off the screen.
 *
 * It lives here rather than in the renderer because the onboarding-ui package's
 * vitest runs in plain Node and cannot import `react-native` — logic decided
 * there is only assertable at source level, and the escape decision is the part
 * of this feature that must not be wrong.
 */
export type RenderableStep<T> = {
  /**
   * The step to parse and render. The SAME reference as the input when nothing
   * was stripped, so the common path allocates nothing and stays `useMemo`-stable.
   */
  step: T;
  /** The elements omitted, for the log. Empty when nothing was stripped. */
  omitted: UnknownElementType[];
  /**
   * The strip left nothing in the tree that can complete the screen, so the
   * renderer must supply an escape of its own — otherwise the user sits on a
   * screen with no CTA and, on a `displayProgressHeader: false` step, no back
   * chevron: the dead end #209 exists to close, re-created silently.
   *
   * Only ever true when something WAS stripped. An authored screen with no way
   * forward is an authoring bug (and the host may advance it another way, e.g. a
   * custom action that navigates); injecting a CTA into shipped screens that
   * have nothing to do with an unknown element type is not this feature's call.
   */
  needsEscape: boolean;
};

/**
 * @param step  A step as fetched, unparsed.
 * @param known The element types the CALLER can render — the renderer's own
 *   capability, not this package's schema. The two are separate packages with a
 *   peer-dependency range between them, so their versions can legitimately
 *   differ, and it is what draws that must decide what is kept. An empty set
 *   means "could not tell" and strips nothing.
 */
export const resolveRenderableStep = <T>(step: T, known?: ReadonlySet<string>): RenderableStep<T> => {
  const renderable = dropUnknownElementTypesInStep(step, known);
  if (renderable === step) return { step, omitted: [], needsEscape: false };

  const authoredElements = (step as { payload?: { elements?: unknown } })?.payload?.elements;
  const renderableElements = (renderable as { payload?: { elements?: unknown } })?.payload?.elements;
  return {
    step: renderable,
    omitted: collectUnknownElementTypes(authoredElements, "elements", known),
    needsEscape: !hasCompletingAction(renderableElements),
  };
};
