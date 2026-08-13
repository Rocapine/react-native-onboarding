import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

/**
 * Multi-element container that lays out child `Text` elements as a **wrapping
 * flex row** — each child is a full `Text` UIElement that wraps to the next line
 * as a whole unit (word or styled "chip"). Unlike inline `TextSpan`s (the `Text`
 * element's `content[]`, which are nested `<Text>` and so cannot carry box
 * styling), each `RichText` child is a real flex child, so it honors its own box
 * props — `padding`, `borderRadius`, `borderWidth`, `backgroundColor`, `margin`,
 * `transform` (e.g. rotated pills), `renderWhen`, and `expression` mode.
 *
 * The text-style fields below (`fontSize`, `color`, …) act as **inherited
 * defaults**: every child `Text` uses them for any matching prop it omits, so a
 * title's base typography is declared once on the container and only the
 * highlighted "chip" children override (color, background, weight). Children
 * always win over the inherited default.
 *
 * Use this to compose mixed runs of plain words and padded/rounded chips that
 * wrap and align together (e.g. a marketing title with highlighted pills). For
 * pure character-level inline flow with text-only styling, use `Text.content`
 * spans instead.
 */
export type RichTextElementProps = BaseBoxProps & {
  // Layout (wrapping row)
  gap?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "baseline" | "stretch";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  /** Defaults to `"wrap"` — the whole point of RichText is multi-line wrapping. */
  flexWrap?: "wrap" | "nowrap";
  // Inherited text-style defaults for children
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export const RichTextElementPropsSchema = BaseBoxPropsSchema.extend({
  gap: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "baseline", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});
