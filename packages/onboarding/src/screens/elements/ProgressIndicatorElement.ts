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
   * Variable bound to the indicator. When `autoplay` is on, the current
   * step-snapped value (in `[minValue, maxValue]`) is written to this variable
   * on each step hop; when `autoplay` is off, the indicator reflects (and
   * animates to) this variable's value.
   */
  variableName?: string;
  /** Static value (in `[minValue, maxValue]`) used when no `variableName` is provided. */
  value?: number;
  /** Animate from `initialValue` to `maxValue` automatically on mount. */
  autoplay?: boolean;
  /** Repeat the autoplay animation indefinitely. */
  loop?: boolean;
  /** Starting value (in `[minValue, maxValue]`). Defaults to `minValue`. */
  initialValue?: number;
  /**
   * Lower bound of the value range. Defaults to 0. The fill fraction is
   * `(value - minValue) / (maxValue - minValue)`, while the label and the
   * written variable carry the raw value (not a percentage).
   */
  minValue?: number;
  /** Upper bound of the value range. Defaults to 100. */
  maxValue?: number;
  /**
   * Quantization step for the displayed label and the written variable.
   * Defaults to 1. Also bounds the per-sweep JS-callback count
   * (`(maxValue - minValue) / step`) — use a coarse step for large ranges to
   * avoid a per-step re-render storm.
   */
  step?: number;
  /** Suffix appended after the label value. Defaults to "%". Set "" or a unit (e.g. " kg"). */
  labelSuffix?: string;
  /** Animation duration in milliseconds. Defaults to 1000. */
  duration?: number;
  /** Delay in milliseconds before the animation starts. Defaults to 0. */
  delay?: number;
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
  value: z.number().optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  initialValue: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().gt(0).optional(),
  labelSuffix: z.string().optional(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: ProgressEasingSchema.optional(),
  color: z.string().optional(),
  trackColor: z.string().optional(),
  thickness: z.number().min(0).optional(),
  size: z.number().min(0).optional(),
  showLabel: z.boolean().optional(),
  labelColor: z.string().optional(),
});
