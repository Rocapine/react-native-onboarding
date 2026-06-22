import React from "react";
import { Image as RNImage, View } from "react-native";
import { SvgUri } from "react-native-svg";

// expo-image decodes webp/avif reliably across platforms (RN's built-in Image is
// flaky for webp on iOS). Optional peer dep — fall back to RN Image when absent,
// mirroring GradientBox's expo-linear-gradient handling.
let ExpoImage: React.ComponentType<any> | null = null;
try {
  ExpoImage = require("expo-image").Image;
} catch {
  // expo-image not installed — RN Image fallback below
}

export type ResizeMode = "cover" | "contain" | "stretch" | "center";

// RN resizeMode → expo-image contentFit.
export const CONTENT_FIT: Record<ResizeMode, "cover" | "contain" | "fill" | "none"> = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "none",
};

// RN resizeMode → SVG preserveAspectRatio (SvgUri has no resizeMode).
export const SVG_ASPECT: Record<ResizeMode, string> = {
  cover: "xMidYMid slice",
  contain: "xMidYMid meet",
  center: "xMidYMid meet",
  stretch: "none",
};

// SVGs need react-native-svg's SvgUri — RN/expo Image can't decode SVG XML. Auto
// -detected by file extension (query-string / hash tolerant) so existing payloads
// with `.svg` URLs just work, no schema change.
export const isSvgUrl = (url: string): boolean =>
  url.split(/[?#]/)[0].toLowerCase().endsWith(".svg");

// Pick expo-image when installed (better webp/avif), else RN Image. resizeMode
// passes through unchanged on RN; maps to contentFit on expo-image. `blurRadius`
// is a native prop on both — undefined leaves the image sharp.
export const renderRaster = (
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

// Convenience for embedding an image inside another element (e.g. a Radio/Checkbox
// item). SVGs need a sized wrapper View (SvgUri can't carry full RN layout itself);
// rasters take the style directly. `style` should carry the size/borderRadius.
export const renderImageSource = (
  url: string,
  resizeMode: ResizeMode | undefined,
  style: any
): React.ReactElement =>
  isSvgUrl(url) ? (
    <View style={style}>
      <SvgUri uri={url} width="100%" height="100%" preserveAspectRatio={SVG_ASPECT[resizeMode ?? "contain"]} />
    </View>
  ) : (
    renderRaster(url, resizeMode, style)
  );
