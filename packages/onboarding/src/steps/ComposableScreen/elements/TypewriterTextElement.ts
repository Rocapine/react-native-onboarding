import { z } from "zod";
import {
  BaseBoxProps,
  BaseBoxPropsSchema,
  type AnimationEasing,
  type EnteringPreset,
  type SpringConfig,
  AnimationEasingSchema,
  EnteringPresetSchema,
  SpringConfigSchema,
} from "./BaseBoxProps";

/**
 * Reveals its text content **one character at a time** with a staggered
 * entering animation — the classic typewriter / staggered-headline effect.
 *
 * Each character mounts its own reanimated entering animation; the per-character
 * `delay` is `delay + charIndex * stagger`, so characters appear in sequence.
 * This is distinct from the whole-block `animation.entering` every element
 * already gets via `BaseBoxProps` (which fades the *entire* string at once), and
 * from `AnimatedText` (an animated number counter).
 *
 * `preset`/`duration`/`delay`/`easing`/`spring` map 1:1 to the reanimated
 * entering-builder modifiers, exactly like `BaseBoxProps.animation.entering`.
 * `stagger` is the typewriter knob — the gap (ms) between consecutive characters.
 */
export type TypewriterTextElementProps = BaseBoxProps & {
  /**
   * The text to reveal. In `expression` mode `{{variable}}` interpolation runs
   * before the string is split into characters. Plain string only (no spans).
   */
  content: string;
  mode?: "plain" | "expression";
  /** Reanimated entering builder applied per character. Default `"FadeInDown"`. */
  preset?: EnteringPreset;
  /** Per-character animation length in ms (reanimated `.duration()`). Default 400. */
  duration?: number;
  /** Lead-in delay (ms) before the first character animates. Default 0. */
  delay?: number;
  /** Gap in ms between consecutive characters — the stagger step. Default 45. */
  stagger?: number;
  /** Easing for the per-character animation. Ignored when `spring` is set. */
  easing?: AnimationEasing;
  /** Spring config (reanimated `.springify()`); wins over `easing` when present. */
  spring?: SpringConfig;
  /** Replay the reveal on a loop (remounts the characters each cycle). Default false. */
  loop?: boolean;
  /** Pause in ms between loop cycles (only when `loop`). Default 1200. */
  loopDelay?: number;
  /** Show a blinking typewriter caret after the text. Default false. */
  cursor?: boolean;
  /** Caret glyph when `cursor` is on. Default "|". */
  cursorChar?: string;
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

export const TypewriterTextElementPropsSchema = BaseBoxPropsSchema.extend({
  content: z.string(),
  mode: z.enum(["plain", "expression"]).optional(),
  preset: EnteringPresetSchema.optional(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  stagger: z.number().min(0).optional(),
  easing: AnimationEasingSchema.optional(),
  spring: SpringConfigSchema.optional(),
  loop: z.boolean().optional(),
  loopDelay: z.number().min(0).optional(),
  cursor: z.boolean().optional(),
  cursorChar: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});
