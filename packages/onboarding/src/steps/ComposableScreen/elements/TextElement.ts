import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

/**
 * A styled inline run of text. Used to compose rich text inside a single
 * `Text` element — spans render as nested `<Text>` and inherit any prop they
 * omit from the parent `Text` (React Native nested-`<Text>` inheritance), so a
 * span only declares the styling it overrides.
 */
export type TextSpan = {
  text: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  /**
   * Font family name. Omit or set to `"inherit"` to inherit the parent
   * `Text` element's resolved font family.
   */
  fontFamily?: string | "inherit";
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  color?: string;
  /** Inline highlight behind the span text. */
  backgroundColor?: string;
  /** Per-span opacity (0–1). */
  opacity?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecorationLine?:
    | "none"
    | "underline"
    | "line-through"
    | "underline line-through";
  textDecorationColor?: string;
  textDecorationStyle?: "solid" | "double" | "dotted" | "dashed";
};

export const TextSpanSchema = z.object({
  text: z.string(),
  fontWeight: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  textDecorationLine: z
    .enum(["none", "underline", "line-through", "underline line-through"])
    .optional(),
  textDecorationColor: z.string().optional(),
  textDecorationStyle: z.enum(["solid", "double", "dotted", "dashed"]).optional(),
});

export type TextElementProps = BaseBoxProps & {
  /**
   * Plain string, or an array of styled spans for inline rich text. In
   * `expression` mode `{{variable}}` interpolation applies to the string or to
   * each span's `text`.
   */
  content: string | TextSpan[];
  mode?: "plain" | "expression";
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

export const TextElementPropsSchema = BaseBoxPropsSchema.extend({
  content: z.union([z.string(), z.array(TextSpanSchema)]),
  mode: z.enum(["plain", "expression"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});
