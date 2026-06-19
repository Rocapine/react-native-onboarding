import React from "react";
import { z } from "zod";
import { View } from "react-native";
import { SvgUri } from "react-native-svg";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, buildShadowStyle, dim } from "./shared";
import { GradientBox } from "./GradientBox";
import { SVG_ASPECT, isSvgUrl, renderRaster } from "./imageSource";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** Uniform Gaussian blur radius (px). 0/undefined = sharp. Ignored for SVGs. */
  blurRadius?: number;
};

export const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  blurRadius: z.number().min(0).optional(),
});

type ImageUIElement = Extract<UIElement, { type: "Image" }>;

type Props = {
  element: ImageUIElement;
  ctx: RenderContext;
};

export const ImageElementComponent = ({ element }: Props): React.ReactElement => {
  const p = element.props;
  const isSvg = isSvgUrl(p.url);
  const hasShadow = p.shadowColor != null || p.elevation != null;
  // iOS clips shadows when overflow:hidden, so a shadow-bearing Image needs a
  // wrapper View carrying the shadow (no overflow clip) and the Image inside
  // with the rounded clip.
  const shadowStyle = hasShadow ? buildShadowStyle(p) : null;

  if (p.backgroundGradient || hasShadow) {
    const wrapperStyle = {
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
      margin: p.margin,
      marginHorizontal: p.marginHorizontal,
      marginVertical: p.marginVertical,
      padding: p.padding,
      paddingHorizontal: p.paddingHorizontal,
      paddingVertical: p.paddingVertical,
      ...(shadowStyle ?? {}),
    };
    // Inner content fills the wrapper (which carries layout + corner clip).
    const innerImage = isSvg ? (
      <SvgUri
        uri={p.url}
        width="100%"
        height="100%"
        preserveAspectRatio={SVG_ASPECT[p.resizeMode ?? "contain"]}
      />
    ) : (
      renderRaster(p.url, p.resizeMode, {
        width: "100%",
        height: "100%",
        borderRadius: p.borderRadius,
        overflow: (p.overflow ?? "hidden") as any,
      }, p.blurRadius)
    );
    if (p.backgroundGradient) {
      return (
        <GradientBox gradient={p.backgroundGradient} style={wrapperStyle as any}>
          {innerImage}
        </GradientBox>
      );
    }
    return <View style={wrapperStyle as any}>{innerImage}</View>;
  }

  const simpleStyle = {
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
    backgroundColor: p.backgroundColor,
    overflow: p.overflow,
    borderRadius: p.borderRadius,
    borderWidth: p.borderWidth,
    borderColor: p.borderColor,
    opacity: p.opacity,
    margin: p.margin,
    marginHorizontal: p.marginHorizontal,
    marginVertical: p.marginVertical,
    padding: p.padding,
    paddingHorizontal: p.paddingHorizontal,
    paddingVertical: p.paddingVertical,
  } as any;

  // SvgUri can't carry the full RN layout style itself, so wrap it in a View that
  // does, and let the SVG fill it.
  if (isSvg) {
    return (
      <View style={simpleStyle}>
        <SvgUri
          uri={p.url}
          width="100%"
          height="100%"
          preserveAspectRatio={SVG_ASPECT[p.resizeMode ?? "contain"]}
        />
      </View>
    );
  }

  return renderRaster(p.url, p.resizeMode, simpleStyle, p.blurRadius);
};
