import { z } from "zod";
import {
  BaseBoxProps,
  BaseBoxPropsSchema,
  GradientEdge,
  GradientEdgeSchema,
} from "./BaseBoxProps";

// A single mask stop: `position` (0..1 along from→to) maps to a blur `opacity`
// (0 = fully sharp at this stop, 1 = full blur). The masked blur layer fades
// between stops, producing the progressive (variable) blur.
export type BlurMaskStop = {
  position: number;
  opacity: number;
};

const BlurMaskStopSchema = z.object({
  position: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
});

// Linear mask (reuses BaseBoxProps' 8-edge direction vocab). `type` is optional
// and defaults to "linear" so existing `{ from, to, stops }` payloads stay valid.
export type LinearBlurMask = {
  type?: "linear";
  from: GradientEdge;
  to: GradientEdge;
  stops: BlurMaskStop[];
};

// Radial mask — sharp at the center, blurring outward (matches the Figma hero
// exactly). `center` is in 0..1 box fractions (default {0.5,0.5}); `radius` is a
// 0..1 fraction of the box (default ~0.75). Rendered via react-native-svg.
export type RadialBlurMask = {
  type: "radial";
  center?: { x: number; y: number };
  radius?: number;
  stops: BlurMaskStop[];
};

export type BlurMask = LinearBlurMask | RadialBlurMask;

const LinearBlurMaskSchema = z.object({
  type: z.literal("linear").optional(),
  from: GradientEdgeSchema,
  to: GradientEdgeSchema,
  stops: z.array(BlurMaskStopSchema).min(2, "blur mask requires at least 2 stops"),
});

const RadialBlurMaskSchema = z.object({
  type: z.literal("radial"),
  center: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  radius: z.number().positive().optional(),
  stops: z.array(BlurMaskStopSchema).min(2, "blur mask requires at least 2 stops"),
});

// Linear first: a `{ from, to, stops }` payload (no `type`) matches it directly;
// a `{ type: "radial", … }` payload fails linear (no from/to) and falls to radial.
const BlurMaskSchema = z.union([LinearBlurMaskSchema, RadialBlurMaskSchema]);

// A full-bleed image with a gradient-masked Gaussian blur baked in: sharp where
// the mask is transparent, progressively blurred where it's opaque. Self-
// contained (owns the image + the blur) so it composes predictably as the
// bottom layer of a ZStack with sharp foreground content above it.
export type ProgressiveBlurImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** expo-blur intensity, 0..100. */
  intensity: number;
  /** expo-blur tint. Defaults to "default". */
  tint?: "light" | "dark" | "default";
  /** Gradient that drives where the blur is strong. */
  mask: BlurMask;
  /** Clamp on the masked blur layer's max opacity (Figma ≈ 0.8). Default 1. */
  maxBlurOpacity?: number;
};

export const ProgressiveBlurImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  intensity: z.number().min(0).max(100),
  tint: z.enum(["light", "dark", "default"]).optional(),
  mask: BlurMaskSchema,
  maxBlurOpacity: z.number().min(0).max(1).optional(),
});
