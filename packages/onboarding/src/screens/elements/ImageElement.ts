import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  /**
   * `expression` enables `{{variable}}` interpolation in `url`, so ONE Image can
   * serve a data-driven set instead of one duplicated subtree per case — e.g.
   * `https://cdn.example.com/zodiac/{{zodiacSign}}.png` replaces 13 gated Images.
   *
   * References resolve to the variable's `value`, NOT its `label` (the inverse of
   * `Text`, which is display copy). A URL segment is a machine identifier: for a
   * variable carrying `{ value: "aries", label: "Aries" }` the URL needs `aries`.
   * An unknown variable interpolates to the empty string, so authors should keep
   * a fallback path segment or a `renderWhen` guard around the element.
   *
   * Defaults to `"plain"` — no interpolation, and the element stays fully static
   * (it does not subscribe to variable writes).
   */
  mode?: "plain" | "expression";
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** Uniform Gaussian blur radius (px). 0/undefined = sharp. Ignored for SVGs. */
  blurRadius?: number;
};

export const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  mode: z.enum(["plain", "expression"]).optional(),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  blurRadius: z.number().min(0).optional(),
});
