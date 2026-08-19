import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type CarouselElementProps = BaseBoxProps & {
  carouselType?: "left-align" | "normal" | "parallax" | "stack";
  autoPlay?: boolean;
  autoPlayInterval?: number;
  loop?: boolean;
  showDots?: boolean;
  dotColor?: string;
  activeDotColor?: string;
  dotWidth?: number;
  dotHeight?: number;
  activeDotWidth?: number;
  activeDotHeight?: number;
  dotsGap?: number;
  dotsPosition?: "top" | "bottom";
  dotsMarginTop?: number;
  dotsMarginBottom?: number;
  defaultIndex?: number | null;
  variableName?: string;
  /**
   * Publishes the carousel's *continuous* swipe position as a screen-scoped
   * animated variable, so sibling elements can gate `renderWhen` on the finger
   * rather than on the settled slide.
   *
   * `variableName` is written only on snap, so it steps 0 → 1 → 2. This tracks
   * the drag: 0 → 0.37 → 0.81 → 1, updating every frame.
   *
   * Value semantics — ALWAYS normalized to `[0, childCount)`:
   *   • the underlying `absoluteProgress` from react-native-reanimated-carousel
   *     is clamped to `[0, n-1]` when `loop: false`, but is UNBOUNDED when
   *     `loop: true` (the library never wraps its internal offset — on the
   *     second lap slide 1 reports 4, not 1, and it keeps climbing).
   *   • `loop` defaults to TRUE here, so publishing the raw value would silently
   *     break any `eq`/`lt`/`gte` gate after the first lap. We therefore publish
   *     `((raw % n) + n) % n`, which is a no-op for `loop: false` and makes every
   *     lap read identically.
   *   • consequence: under `loop: true` the value is discontinuous at the wrap
   *     seam, jumping from just under `n` back to 0. That is the same seam the
   *     dots cross, so it matches what the user sees.
   *
   * Consumed on the UI thread — see `AnimatedVariablesContext` / `GatedElement`.
   * Note `eq` compares the ROUNDED value, so `eq 1` flips once the swipe passes
   * halfway to slide 1 (that is the intended "fade in during the gesture" feel).
   *
   * Safe to set to the same string as `variableName`: the store then holds the
   * snapped integer for branching/analytics while gates on this screen read the
   * live value, since an animated variable takes precedence in `GatedElement`.
   */
  progressVariableName?: string;
};

export const CarouselElementPropsSchema = BaseBoxPropsSchema.extend({
  carouselType: z.enum(["left-align", "normal", "parallax", "stack"]).optional().default("normal"),
  autoPlay: z.boolean().optional().default(false),
  autoPlayInterval: z.number().nonnegative().optional().default(3000),
  loop: z.boolean().optional().default(true),
  showDots: z.boolean().optional().default(true),
  dotColor: z.string().optional(),
  activeDotColor: z.string().optional(),
  dotWidth: z.number().nonnegative().optional().default(20),
  dotHeight: z.number().nonnegative().optional().default(4),
  activeDotWidth: z.number().nonnegative().optional(),
  activeDotHeight: z.number().nonnegative().optional(),
  dotsGap: z.number().nonnegative().optional().default(8),
  dotsPosition: z.enum(["top", "bottom"]).optional().default("bottom"),
  dotsMarginTop: z.number().optional().default(12),
  dotsMarginBottom: z.number().optional().default(0),
  defaultIndex: z.number().int().nonnegative().nullable().optional(),
  variableName: z.string().min(1).optional(),
  progressVariableName: z.string().min(1).optional(),
});
