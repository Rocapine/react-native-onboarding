import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

/**
 * Value-bound reaction slot rendered next to the slider. Reuses an existing
 * media element type (Lottie / Rive / Image) so authors get animated feedback
 * as the value changes.
 *
 * Two binding modes (exactly one):
 * - `source`: a single asset (intended for progress-driven media — a follow-up;
 *   the first cut renders it statically).
 * - `stops`: discrete swap — render the source whose `atValue` is the highest
 *   value `<= current`. Works with the existing Image/Lottie/Rive renderers today.
 */
export type SliderReactionStop = { atValue: number; source: string };

export type SliderReaction = {
  type: "Lottie" | "Rive" | "Image";
  source?: string;
  stops?: SliderReactionStop[];
  height?: number;
};

export type SliderElementProps = BaseBoxProps & {
  /** Variable the snapped numeric value is written to (stored as a string). */
  variableName?: string;
  min: number;
  max: number;
  /** Snap increment. Default 1. Must be > 0. */
  step?: number;
  /** Initial value, clamped to [min, max]. Default = min. */
  defaultValue?: number;
  /** Left-end caption under the track. */
  minLabel?: string;
  /** Right-end caption under the track. */
  maxLabel?: string;
  /** Render the live numeric value above the track. Default false. */
  showValue?: boolean;
  /** Unappended unit suffix shown next to the value (e.g. "kg"). */
  valueSuffix?: string;
  trackColor?: string;
  trackFilledColor?: string;
  /** Track thickness in px. Default 4. */
  trackHeight?: number;
  knobColor?: string;
  /** Knob diameter in px. Default 24. */
  knobSize?: number;
  reaction?: SliderReaction;
};

const SliderReactionStopSchema = z.object({
  atValue: z.number(),
  source: z.string().trim().min(1, "reaction stop source must not be empty"),
});

const SliderReactionSchema = z.object({
  type: z.enum(["Lottie", "Rive", "Image"]),
  source: z.string().trim().min(1).optional(),
  stops: z.array(SliderReactionStopSchema).min(1, "reaction stops must not be empty").optional(),
  height: z.number().positive().optional(),
});

export const SliderElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().optional(),
  defaultValue: z.number().optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  showValue: z.boolean().optional(),
  valueSuffix: z.string().optional(),
  trackColor: z.string().optional(),
  trackFilledColor: z.string().optional(),
  trackHeight: z.number().positive().optional(),
  knobColor: z.string().optional(),
  knobSize: z.number().positive().optional(),
  reaction: SliderReactionSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.max <= data.min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "max must be greater than min",
      path: ["max"],
    });
  }
  if (data.defaultValue !== undefined && (data.defaultValue < data.min || data.defaultValue > data.max)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "defaultValue must be within [min, max]",
      path: ["defaultValue"],
    });
  }
  if (data.reaction) {
    const hasSource = data.reaction.source !== undefined;
    const hasStops = data.reaction.stops !== undefined;
    // Exactly one binding source — both or neither is ambiguous.
    if (hasSource === hasStops) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reaction must provide exactly one of `source` or `stops`",
        path: ["reaction", hasSource ? "stops" : "source"],
      });
    }
    if (hasStops) {
      data.reaction.stops!.forEach((stop, i) => {
        if (stop.atValue < data.min || stop.atValue > data.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "reaction stop atValue must be within [min, max]",
            path: ["reaction", "stops", i, "atValue"],
          });
        }
      });
    }
  }
});

/** Snap a raw value to the nearest step and clamp to [min, max]. Shared by the
 * UI renderer and default-collection so both agree on the stored value. */
export function snapSliderValue(props: SliderElementProps, raw: number): number {
  const step = props.step && props.step > 0 ? props.step : 1;
  const clamped = Math.min(props.max, Math.max(props.min, raw));
  const steps = Math.round((clamped - props.min) / step);
  const snapped = props.min + steps * step;
  // Trim float accumulation noise (e.g. 0.30000000000000004 → 0.3) and re-clamp.
  const trimmed = Math.round(snapped * 1e6) / 1e6;
  return Math.min(props.max, Math.max(props.min, trimmed));
}

/** Resolve the effective default value: explicit `defaultValue` (already
 * range-validated) or `min`. */
export function resolveSliderDefault(props: SliderElementProps): number {
  return props.defaultValue ?? props.min;
}
