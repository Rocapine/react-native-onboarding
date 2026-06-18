import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

/**
 * Freehand drawing surface (signature, doodle, etc.). On each completed stroke
 * the captured drawing is serialized into runtime variable(s):
 * - `variableName`      → SVG path `d` string (compact, vector, canonical)
 * - `imageVariableName` → base64 PNG/JPEG data URI (raster, drop-in for Image / upload)
 *
 * Requires the optional peer dependency `@shopify/react-native-skia`.
 */
export type DrawingPadElementProps = BaseBoxProps & {
  /** Variable receiving the serialized SVG path string. */
  variableName?: string;
  /** Variable receiving a base64 image data URI (`data:image/png;base64,…`). */
  imageVariableName?: string;
  /** Stroke color. Defaults to `theme.colors.text.primary`. */
  strokeColor?: string;
  /** Stroke width in px. Defaults to `2`. */
  strokeWidth?: number;
  /** Canvas background (also painted into the exported image). Defaults to `theme.colors.neutral.lowest`. */
  backgroundColor?: string;
  /** Show a clear button to reset the drawing. Defaults to `true`. */
  clearable?: boolean;
  /** Corner the clear button sits in. Defaults to `"top-right"`. */
  clearButtonPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Distance (px) of the clear button from the two nearest edges. Defaults to `8`. */
  clearButtonOffset?: number;
  /** Clear button diameter (px). Defaults to `32`. */
  clearButtonSize?: number;
  /** Clear button background color. Defaults to `theme.colors.neutral.higher`. */
  clearButtonColor?: string;
  /** Clear button glyph/icon color. Defaults to `theme.colors.text.opposite`. */
  clearButtonIconColor?: string;
  /** Clear button glyph/label. Defaults to `"✕"`. */
  clearButtonLabel?: string;
  /** Encode format for `imageVariableName`. Defaults to `"png"`. */
  imageFormat?: "png" | "jpeg";
};

export const DrawingPadElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  imageVariableName: z.string().min(1).optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  backgroundColor: z.string().optional(),
  clearable: z.boolean().optional(),
  clearButtonPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  clearButtonOffset: z.number().min(0).optional(),
  clearButtonSize: z.number().positive().optional(),
  clearButtonColor: z.string().optional(),
  clearButtonIconColor: z.string().optional(),
  clearButtonLabel: z.string().optional(),
  imageFormat: z.enum(["png", "jpeg"]).optional(),
});
