import React from "react";
import { z } from "zod";
import { Image as RNImage, View, StyleSheet, UIManager } from "react-native";
import Svg, { Defs, Rect, RadialGradient, Stop } from "react-native-svg";
import { BaseBoxProps, BaseBoxPropsSchema, GradientEdge } from "./BaseBoxProps";
import type { GradientBackground } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";

// expo-image (better webp/avif) — optional, falls back to RN Image.
let ExpoImage: React.ComponentType<any> | null = null;
try {
  ExpoImage = require("expo-image").Image;
} catch {
  // expo-image not installed — RN Image fallback below
}

// @react-native-masked-view/masked-view — optional. Absent → no progressive
// mask, so we degrade to a flat gradient scrim rather than a full-screen blur.
let MaskedView: React.ComponentType<any> | null = null;
try {
  MaskedView = require("@react-native-masked-view/masked-view").default;
} catch {
  // masked-view not installed
}

// expo-linear-gradient — optional. Used for the LINEAR mask + tint/scrim
// gradients. Absent → plain dark View scrim (radial masks use react-native-svg,
// a required dep, so they don't depend on this).
let LinearGradient: React.ComponentType<any> | null = null;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  // expo-linear-gradient not installed
}

// Mirror of the headless schema (UI mirrors stay self-contained — they don't
// import headless internals). Keep in lockstep with
// packages/onboarding/src/steps/ComposableScreen/elements/ProgressiveBlurImageElement.ts.
export type BlurMaskStop = { position: number; opacity: number };
export type LinearBlurMask = { type?: "linear"; from: GradientEdge; to: GradientEdge; stops: BlurMaskStop[] };
export type RadialBlurMask = {
  type: "radial";
  center?: { x: number; y: number };
  radius?: number;
  stops: BlurMaskStop[];
};
export type BlurMask = LinearBlurMask | RadialBlurMask;

export type ProgressiveBlurImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  intensity: number;
  tint?: "light" | "dark" | "default";
  mask: BlurMask;
  maxBlurOpacity?: number;
};

const BlurMaskStopSchema = z.object({
  position: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
});

const EDGE_ENUM = z.enum(["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"]);

const LinearBlurMaskSchema = z.object({
  type: z.literal("linear").optional(),
  from: EDGE_ENUM,
  to: EDGE_ENUM,
  stops: z.array(BlurMaskStopSchema).min(2, "blur mask requires at least 2 stops"),
});

const RadialBlurMaskSchema = z.object({
  type: z.literal("radial"),
  center: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  radius: z.number().positive().optional(),
  stops: z.array(BlurMaskStopSchema).min(2, "blur mask requires at least 2 stops"),
});

export const ProgressiveBlurImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  intensity: z.number().min(0).max(100),
  tint: z.enum(["light", "dark", "default"]).optional(),
  mask: z.union([LinearBlurMaskSchema, RadialBlurMaskSchema]),
  maxBlurOpacity: z.number().min(0).max(1).optional(),
});

type ResizeMode = "cover" | "contain" | "stretch" | "center";

const CONTENT_FIT: Record<ResizeMode, "cover" | "contain" | "fill" | "none"> = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "none",
};

const EDGE_POINT: Record<string, { x: number; y: number }> = {
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
  right: { x: 1, y: 0.5 },
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomLeft: { x: 0, y: 1 },
  bottomRight: { x: 1, y: 1 },
};

const renderRaster = (
  url: string,
  resizeMode: ResizeMode | undefined,
  style: any,
  blurRadius?: number
): React.ReactElement =>
  ExpoImage ? (
    <ExpoImage source={url} contentFit={CONTENT_FIT[resizeMode ?? "cover"]} blurRadius={blurRadius} style={style} />
  ) : (
    <RNImage source={{ uri: url }} resizeMode={resizeMode} blurRadius={blurRadius} style={style} />
  );

// expo-blur's BlurView blurs the *backdrop behind it*, but a MaskedView renders
// its child into an isolated offscreen layer with no backdrop to sample — so a
// masked BlurView is transparent on iOS (no blur, no tint). Instead we mask a
// real blurred *copy* of the image, which composites reliably on both platforms.
// Map the 0–100 intensity onto an expo-image/RN blurRadius in px.
const intensityToBlurRadius = (intensity: number): number => Math.max(0, Math.round(intensity * 0.3));

const isRadialMask = (mask: BlurMask): mask is RadialBlurMask => mask.type === "radial";

type BlurUIElement = Extract<UIElement, { type: "ProgressiveBlurImage" }>;

type Props = {
  element: BlurUIElement;
  ctx: RenderContext;
};

// ---------------------------------------------------------------------------
// LINEAR helpers (expo-linear-gradient).
// ---------------------------------------------------------------------------

// Mask alpha (= blur strength) → black with that alpha. MaskedView keys off the
// alpha channel of its mask element, so a transparent→opaque black ramp reveals
// the blurred image copy only where the mask is opaque.
const linearMaskColors = (mask: LinearBlurMask, maxBlurOpacity: number): string[] =>
  mask.stops.map((s) => `rgba(0,0,0,${(s.opacity * maxBlurOpacity).toFixed(3)})`);

// `tint` → an rgb triple for the darkening/lightening overlay. "default" = no tint.
const tintRgb = (tint?: "light" | "dark" | "default"): string | null =>
  tint === "dark" ? "0,0,0" : tint === "light" ? "255,255,255" : null;

// A linear color gradient following the mask shape (tint overlay / fallback
// scrim). Tint alpha tracks the mask strength × maxBlurOpacity so a "dark" tint
// actually reads dark (no extra dampening).
const linearColorGradient = (
  mask: LinearBlurMask,
  maxBlurOpacity: number,
  rgb: string
): GradientBackground => ({
  type: "linear",
  from: mask.from,
  to: mask.to,
  stops: mask.stops.map((s) => ({
    color: `rgba(${rgb},${(s.opacity * maxBlurOpacity).toFixed(3)})`,
    position: s.position,
  })),
});

// ---------------------------------------------------------------------------
// RADIAL helpers (react-native-svg — a required dep, always available).
// A radial color/alpha gradient rect; `objectBoundingBox` units map cx/cy/r to
// 0..1 fractions of the box (so a non-square box yields the Figma ellipse).
// ---------------------------------------------------------------------------

const RadialSvg = ({
  mask,
  id,
  color,
  opacityScale,
}: {
  mask: RadialBlurMask;
  id: string;
  /** SVG stop color, e.g. "black" or "rgb(0,0,0)". */
  color: string;
  /** Multiplier applied to each stop's opacity. */
  opacityScale: number;
}): React.ReactElement => {
  const c = mask.center ?? { x: 0.5, y: 0.5 };
  const r = mask.radius ?? 0.75;
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx={String(c.x)} cy={String(c.y)} r={String(r)} gradientUnits="objectBoundingBox">
          {mask.stops.map((s, i) => (
            <Stop
              key={i}
              offset={String(s.position)}
              stopColor={color}
              stopOpacity={String(Math.min(1, s.opacity * opacityScale))}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
};

// The JS package may be present (hoisted in a monorepo / installed) while the
// NATIVE view manager is missing — e.g. a dev-client binary built before the
// dep was added. Then `require` succeeds but rendering `<MaskedView>` throws
// "View config not found for component RNCMaskedView". Probe the native registry
// when we can; `hasViewManagerConfig` is absent on some arch/versions, so a
// `false` only suppresses when we can actually tell (the boundary below is the
// reliable backstop in all other cases).
const nativeMaskedViewAvailable = (): boolean => {
  const has = (UIManager as any)?.hasViewManagerConfig;
  if (typeof has !== "function") return true; // can't determine → let the boundary guard it
  return !!has("RNCMaskedView");
};

// Backstop: if the masked-blur subtree throws at render/commit (native view
// missing on the running binary), swap to the plain fallback instead of
// crashing the whole onboarding screen.
class ProgressiveBlurBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // swallow — degradation is intentional, not an error to surface
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const ProgressiveBlurImageElementComponent = ({ element }: Props): React.ReactElement => {
  const p = element.props;
  const maxBlurOpacity = p.maxBlurOpacity ?? 1;
  const radial = isRadialMask(p.mask);
  const rgb = tintRgb(p.tint);

  const containerStyle = {
    flex: p.flex,
    flexShrink: p.flexShrink,
    flexGrow: p.flexGrow,
    alignSelf: p.alignSelf,
    aspectRatio: p.aspectRatio,
    width: dim(p.width),
    height: dim(p.height),
    minWidth: p.minWidth,
    maxWidth: p.maxWidth,
    minHeight: p.minHeight,
    maxHeight: p.maxHeight,
    borderRadius: p.borderRadius,
    borderWidth: p.borderWidth,
    borderColor: p.borderColor,
    opacity: p.opacity,
    overflow: (p.overflow ?? "hidden") as any,
    margin: p.margin,
    marginHorizontal: p.marginHorizontal,
    marginVertical: p.marginVertical,
    backgroundColor: p.backgroundColor,
  } as any;

  const sharpImage = renderRaster(p.url, p.resizeMode, StyleSheet.absoluteFillObject);

  // Dark scrim (degraded path + error-boundary fallback). Radial → SVG (always
  // available), linear → GradientBox (plain View when expo-linear-gradient absent).
  // `isRadialMask(p.mask)` narrows the union in each branch.
  const scrim = isRadialMask(p.mask) ? (
    <RadialSvg mask={p.mask} id={`pbi-fb-${element.id}`} color="black" opacityScale={maxBlurOpacity} />
  ) : (
    <GradientBox
      gradient={linearColorGradient(p.mask, maxBlurOpacity, "0,0,0")}
      style={StyleSheet.absoluteFillObject as any}
    />
  );

  const fallback = (
    <View style={containerStyle}>
      {sharpImage}
      {scrim}
    </View>
  );

  // Full path needs masked-view (+ its native view) and, for a LINEAR mask, the
  // expo-linear-gradient dep. A RADIAL mask renders via react-native-svg (always
  // available). expo-blur is intentionally not used — a masked BlurView is
  // transparent on iOS (see renderRaster note).
  const gradientDepReady = radial || !!LinearGradient;
  const canProgressiveBlur = MaskedView && nativeMaskedViewAvailable() && gradientDepReady;

  if (!canProgressiveBlur) return fallback;

  const Masked = MaskedView!;
  const Gradient = LinearGradient as React.ComponentType<any>; // non-null for linear masks (gradientDepReady)
  const blurredCopy = renderRaster(
    p.url,
    p.resizeMode,
    StyleSheet.absoluteFillObject,
    intensityToBlurRadius(p.intensity)
  );

  // Mask element: opaque where the blur should show.
  const maskElement = isRadialMask(p.mask) ? (
    <RadialSvg mask={p.mask} id={`pbi-mask-${element.id}`} color="black" opacityScale={maxBlurOpacity} />
  ) : (
    <Gradient
      colors={linearMaskColors(p.mask, maxBlurOpacity)}
      start={EDGE_POINT[p.mask.from]}
      end={EDGE_POINT[p.mask.to]}
      locations={p.mask.stops.map((s) => s.position)}
      style={StyleSheet.absoluteFillObject}
    />
  );

  // Tint overlay following the mask shape (the Figma dark tint).
  const tintOverlay =
    rgb == null ? null : isRadialMask(p.mask) ? (
      <RadialSvg mask={p.mask} id={`pbi-tint-${element.id}`} color={`rgb(${rgb})`} opacityScale={maxBlurOpacity} />
    ) : (
      <GradientBox
        gradient={linearColorGradient(p.mask, maxBlurOpacity, rgb)}
        style={StyleSheet.absoluteFillObject as any}
      />
    );

  return (
    <ProgressiveBlurBoundary fallback={fallback}>
      <View style={containerStyle}>
        {/* Sharp base. */}
        {sharpImage}
        {/* Blurred copy, revealed only where the mask is opaque → progressive blur. */}
        <Masked style={StyleSheet.absoluteFillObject} maskElement={maskElement}>
          {blurredCopy}
        </Masked>
        {tintOverlay}
      </View>
    </ProgressiveBlurBoundary>
  );
};
