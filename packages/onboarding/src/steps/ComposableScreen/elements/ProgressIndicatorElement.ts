import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

/**
 * Easing curve names selectable for the progress animation. Mapped to the
 * matching CSS-style cubic-bezier curves in the renderer.
 */
export type ProgressEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type ProgressIndicatorElementProps = BaseBoxProps & {
  /** Visual style of the indicator. */
  variant?: "linear" | "circular";
  /**
   * Variable bound to the indicator (int 0-100). When `autoplay` is on, the
   * current rounded progress is written to this variable on each frame; when
   * `autoplay` is off, the indicator reflects (and animates to) this variable's
   * value.
   */
  variableName?: string;
  /** Static value (0-100) used when no `variableName` is provided. */
  value?: number;
  /** Animate from `initialValue` to 100 automatically on mount. */
  autoplay?: boolean;
  /** Repeat the autoplay animation indefinitely. */
  loop?: boolean;
  /** Starting value (0-100). Defaults to 0. */
  initialValue?: number;
  /** Animation duration in milliseconds. Defaults to 1000. */
  duration?: number;
  /** Easing curve for the animation. Defaults to "ease-in-out". */
  easing?: ProgressEasing;
  /** Progress fill color. Defaults to theme primary. */
  color?: string;
  /** Track (unfilled) color. Defaults to theme neutral.lower. */
  trackColor?: string;
  /** Bar height (linear) / ring stroke width (circular). */
  thickness?: number;
  /** Diameter of the circular variant in px. Defaults to 120. */
  size?: number;
  /** Show the percentage label (centered for circular, alongside for linear). */
  showLabel?: boolean;
  /** Label text color. Defaults to theme text.primary. */
  labelColor?: string;
};

const ProgressEasingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]);

export const ProgressIndicatorElementPropsSchema = BaseBoxPropsSchema.extend({
  variant: z.enum(["linear", "circular"]).optional(),
  variableName: z.string().min(1).optional(),
  value: z.number().min(0).max(100).optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  initialValue: z.number().min(0).max(100).optional(),
  duration: z.number().min(0).optional(),
  easing: ProgressEasingSchema.optional(),
  color: z.string().optional(),
  trackColor: z.string().optional(),
  thickness: z.number().min(0).optional(),
  size: z.number().min(0).optional(),
  showLabel: z.boolean().optional(),
  labelColor: z.string().optional(),
});
