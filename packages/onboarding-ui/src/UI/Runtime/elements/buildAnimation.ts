import * as Reanimated from "react-native-reanimated";
import { Easing } from "react-native-reanimated";
import type {
  AnimationEasing,
  EnteringAnimation,
  ExitingAnimation,
  LayoutAnimation,
} from "@rocapine/react-native-onboarding";

// CSS-style cubic-bezier curves matching the selectable easing names. Shared by
// the animation builders here and by ProgressIndicatorElement (single source).
export const EASING_MAP: Record<
  AnimationEasing,
  ReturnType<typeof Easing.bezier> | typeof Easing.linear
> = {
  linear: Easing.linear,
  "ease-in": Easing.bezier(0.42, 0, 1, 1),
  "ease-out": Easing.bezier(0, 0, 0.58, 1),
  "ease-in-out": Easing.bezier(0.42, 0, 0.58, 1),
};

// Reanimated builders are exported by name off the namespace. Looking them up by
// the schema's `preset` string is what keeps the JSON 1:1 with reanimated — the
// preset value *is* the builder name. Unknown/typo presets degrade to `undefined`
// (no animation) instead of crashing, so a payload referencing a preset the host's
// installed reanimated version lacks still mounts.
type AnyBuilder = any;

const resolveBuilder = (preset: string): AnyBuilder | undefined => {
  const b = (Reanimated as unknown as Record<string, AnyBuilder>)[preset];
  return b ?? undefined;
};

const applySpringOrEasing = (
  builder: AnyBuilder,
  spring?: { damping?: number; stiffness?: number; mass?: number },
  easing?: AnimationEasing
): AnyBuilder => {
  // reanimated: `spring` (`.springify()`) and `.easing()` are mutually exclusive.
  // Spring wins, matching the schema contract.
  if (spring) {
    let b = builder.springify();
    if (spring.damping != null) b = b.damping(spring.damping);
    if (spring.stiffness != null) b = b.stiffness(spring.stiffness);
    if (spring.mass != null) b = b.mass(spring.mass);
    return b;
  }
  if (easing) return builder.easing(EASING_MAP[easing]);
  return builder;
};

const buildTransition = (
  cfg: EnteringAnimation | ExitingAnimation | undefined
): AnyBuilder | undefined => {
  if (!cfg) return undefined;
  let b = resolveBuilder(cfg.preset);
  if (!b) return undefined;
  if (cfg.duration != null) b = b.duration(cfg.duration);
  if (cfg.delay != null) b = b.delay(cfg.delay);
  return applySpringOrEasing(b, cfg.spring, cfg.easing);
};

export const buildEntering = (cfg: EnteringAnimation | undefined): AnyBuilder | undefined =>
  buildTransition(cfg);

export const buildExiting = (cfg: ExitingAnimation | undefined): AnyBuilder | undefined =>
  buildTransition(cfg);

export const buildLayout = (cfg: LayoutAnimation | undefined): AnyBuilder | undefined => {
  if (!cfg) return undefined;
  let b = resolveBuilder(cfg.preset);
  if (!b) return undefined;
  // Layout transitions are referenced as static builder objects; calling a
  // modifier returns a configured instance.
  if (cfg.duration != null) b = b.duration(cfg.duration);
  if (cfg.spring) {
    b = b.springify();
    if (cfg.spring.damping != null) b = b.damping(cfg.spring.damping);
    if (cfg.spring.stiffness != null) b = b.stiffness(cfg.spring.stiffness);
    if (cfg.spring.mass != null) b = b.mass(cfg.spring.mass);
  }
  return b;
};
