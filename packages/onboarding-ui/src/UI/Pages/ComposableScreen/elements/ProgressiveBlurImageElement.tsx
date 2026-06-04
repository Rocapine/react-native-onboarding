import React from "react";
import { z } from "zod";
import { Image as RNImage, View, StyleSheet, UIManager } from "react-native";
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

// expo-blur BlurView — optional. Absent → degrade to a flat gradient scrim.
let BlurView: React.ComponentType<any> | null = null;
try {
  BlurView = require("expo-blur").BlurView;
} catch {
  // expo-blur not installed
}

// @react-native-masked-view/masked-view — optional. Absent → no progressive
// mask, so we degrade to a flat gradient scrim rather than a full-screen blur.
let MaskedView: React.ComponentType<any> | null = null;
try {
  MaskedView = require("@react-native-masked-view/masked-view").default;
} catch {
  // masked-view not installed
}

// expo-linear-gradient — optional. Used both for the mask gradient and the
// fallback scrim. Absent → plain dark View scrim.
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
export type BlurMask = { from: GradientEdge; to: GradientEdge; stops: BlurMaskStop[] };

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

export const ProgressiveBlurImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  intensity: z.number().min(0).max(100),
  tint: z.enum(["light", "dark", "default"]).optional(),
  mask: z.object({
    from: z.enum(["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"]),
    to: z.enum(["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"]),
    stops: z.array(BlurMaskStopSchema).min(2, "blur mask requires at least 2 stops"),
  }),
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

const renderRaster = (url: string, resizeMode: ResizeMode | undefined, style: any): React.ReactElement =>
  ExpoImage ? (
    <ExpoImage source={url} contentFit={CONTENT_FIT[resizeMode ?? "cover"]} style={style} />
  ) : (
    <RNImage source={{ uri: url }} resizeMode={resizeMode} style={style} />
  );

type BlurUIElement = Extract<UIElement, { type: "ProgressiveBlurImage" }>;

type Props = {
  element: BlurUIElement;
  ctx: RenderContext;
};

// Mask alpha (= blur strength) → black with that alpha. MaskedView keys off the
// alpha channel of its mask element, so a transparent→opaque black ramp makes
// the BlurView visible only where the mask is opaque.
const maskColors = (mask: BlurMask, maxBlurOpacity: number): string[] =>
  mask.stops.map((s) => `rgba(0,0,0,${(s.opacity * maxBlurOpacity).toFixed(3)})`);

// Fallback scrim: reuse the mask shape as a dark color gradient so the bottom
// still darkens for text legibility when blur deps are absent.
const fallbackGradient = (mask: BlurMask, maxBlurOpacity: number): GradientBackground => ({
  type: "linear",
  from: mask.from,
  to: mask.to,
  stops: mask.stops.map((s) => ({
    color: `rgba(0,0,0,${(s.opacity * maxBlurOpacity * 0.6).toFixed(3)})`,
    position: s.position,
  })),
});

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
  const locations = p.mask.stops.map((s) => s.position);

  // Degraded path: sharp image + a dark gradient scrim (GradientBox falls back
  // to a plain View when expo-linear-gradient is also absent). Used both when a
  // dep is missing and as the error-boundary fallback when the native view of a
  // present-in-JS dep is absent on the running binary.
  const fallback = (
    <View style={containerStyle}>
      {sharpImage}
      <GradientBox
        gradient={fallbackGradient(p.mask, maxBlurOpacity)}
        style={StyleSheet.absoluteFillObject as any}
      />
    </View>
  );

  // Full path requires all three optional deps in JS *and* the masked-view
  // native view to be registered.
  const canProgressiveBlur =
    BlurView && MaskedView && LinearGradient && nativeMaskedViewAvailable();

  if (!canProgressiveBlur) return fallback;

  const Masked = MaskedView!;
  const Gradient = LinearGradient!;
  const Blur = BlurView!;
  return (
    <ProgressiveBlurBoundary fallback={fallback}>
      <View style={containerStyle}>
        {sharpImage}
        <Masked
          style={StyleSheet.absoluteFillObject}
          maskElement={
            <Gradient
              colors={maskColors(p.mask, maxBlurOpacity)}
              start={EDGE_POINT[p.mask.from]}
              end={EDGE_POINT[p.mask.to]}
              locations={locations}
              style={StyleSheet.absoluteFillObject}
            />
          }
        >
          <Blur
            intensity={p.intensity}
            tint={p.tint ?? "default"}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFillObject}
          />
        </Masked>
      </View>
    </ProgressiveBlurBoundary>
  );
};
