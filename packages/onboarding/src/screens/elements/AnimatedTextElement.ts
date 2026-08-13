import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema, type AnimationEasing } from "./BaseBoxProps";

/**
 * A number that count-animates from `from` to `to` and renders as formatted
 * text. The animation runs entirely on the UI thread (reanimated) and writes
 * the value straight into a native `TextInput` — so it produces **no React
 * re-render per frame** and never touches the variable store.
 *
 * This is the performant counterpart to driving a count-up through a
 * `ProgressIndicator` bound to a variable (which re-renders the whole tree on
 * every step). Use it for animated stat counters ("+1,028,709 members"); pair
 * a static label as a sibling `Text` element (this element renders the number
 * only). Easing reuses the shared `AnimationEasing` curve names.
 */
export type AnimatedTextElementProps = BaseBoxProps & {
  /** Start value of the count animation. Defaults to 0. */
  from?: number;
  /** End value of the count animation. */
  to: number;
  /** Animation duration in milliseconds. Defaults to 1000. */
  duration?: number;
  /** Delay in milliseconds before the animation starts. Defaults to 0. */
  delay?: number;
  /** Easing curve for the count. Defaults to "ease-out". */
  easing?: AnimationEasing;
  /** Animate automatically on mount. Defaults to true. */
  autoplay?: boolean;
  /** Repeat the count animation indefinitely. Defaults to false. */
  loop?: boolean;
  /** Decimal places in the displayed number. Defaults to 0. */
  decimals?: number;
  /**
   * Grouping separator for the integer part (e.g. "1,028,709"). Defaults to
   * ",". Set "" to disable grouping.
   */
  thousandsSeparator?: string;
  fontSize?: number;
  fontWeight?: string;
  /**
   * Font family name. Omit or set to `"inherit"` to inherit from
   * `theme.typography.defaultFontFamily`.
   */
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

const EasingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]);

export const AnimatedTextElementPropsSchema = BaseBoxPropsSchema.extend({
  from: z.number().optional(),
  to: z.number(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: EasingSchema.optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  decimals: z.number().int().min(0).optional(),
  thousandsSeparator: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});
