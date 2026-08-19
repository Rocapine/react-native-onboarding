import React from "react";
import { z } from "zod";
import { View } from "react-native";
import { SvgUri } from "react-native-svg";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import {
  RenderContext,
  buildShadowStyle,
  dim,
  areElementPropsEqual,
  interpolateIdentifier,
} from "./shared";
import { useVariables } from "./VariablesContext";
import { GradientBox } from "./GradientBox";
import { SVG_ASPECT, isSvgUrl, renderRaster } from "./imageSource";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  /**
   * `expression` enables `{{variable}}` interpolation in `url`. References resolve
   * to the variable's `value`, not its `label` — a URL segment is an identifier,
   * not display copy. Defaults to `"plain"`, which stays fully static.
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

type ImageUIElement = Extract<UIElement, { type: "Image" }>;

type Props = {
  element: ImageUIElement;
  ctx: RenderContext;
};

// Empty map for the plain path, so the base component keeps ONE code path while
// the plain variant still never subscribes to variable writes.
const EMPTY_VARS = {} as Record<string, never>;

type BaseProps = Props & { variables: Record<string, any> };

const ImageElementComponentBase = ({ element, variables }: BaseProps): React.ReactElement => {
  const p = element.props;
  // Resolved ONCE here so every downstream use (SVG detection, SvgUri, raster)
  // sees the same string — an SVG behind a `{{var}}` must still be detected as one.
  const url = p.mode === "expression" ? interpolateIdentifier(p.url, variables) : p.url;
  const isSvg = isSvgUrl(url);
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
    // The wrapper paints the border, so the inner image fills the *content box*
    // (inset by borderWidth on every side). Clipping the image to the outer
    // `borderRadius` over-rounds its corners relative to the border's concentric
    // inner edge (radius = outer − borderWidth), leaving a white gap at the
    // corners. Subtract the border width so the image's rounded corners sit flush
    // inside the frame. No border radius (undefined) → leave undefined (unchanged).
    // NOTE: only the border is accounted for, not `padding` — a border + padding +
    // rounded combo (unusual on a photo) would inset the image past this radius and
    // reintroduce a smaller corner gap; not handled deliberately.
    const innerBorderRadius =
      p.borderRadius != null
        ? Math.max(0, p.borderRadius - (p.borderWidth ?? 0))
        : undefined;
    // Inner content fills the wrapper (which carries layout + corner clip).
    const innerImage = isSvg ? (
      <SvgUri
        uri={url}
        width="100%"
        height="100%"
        preserveAspectRatio={SVG_ASPECT[p.resizeMode ?? "contain"]}
      />
    ) : (
      renderRaster(url, p.resizeMode, {
        width: "100%",
        height: "100%",
        borderRadius: innerBorderRadius,
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
          uri={url}
          width="100%"
          height="100%"
          preserveAspectRatio={SVG_ASPECT[p.resizeMode ?? "contain"]}
        />
      </View>
    );
  }

  return renderRaster(url, p.resizeMode, simpleStyle, p.blurRadius);
};

// Plain Image never reads variables → fully static; memo-skips on every write.
// Mirrors the Text plain/expression split (see renderConcrete) so adding
// interpolation costs nothing for the overwhelmingly common static case.
const PlainImageElementComponent = React.memo(
  (props: Props): React.ReactElement => (
    <ImageElementComponentBase {...props} variables={EMPTY_VARS} />
  ),
  areElementPropsEqual
);
PlainImageElementComponent.displayName = "PlainImageElementComponent";

// Expression Image interpolates `{{var}}` into `url` → subscribes to writes.
const ExpressionImageElementComponent = React.memo(
  (props: Props): React.ReactElement => {
    const { variables } = useVariables();
    return <ImageElementComponentBase {...props} variables={variables} />;
  },
  areElementPropsEqual
);
ExpressionImageElementComponent.displayName = "ExpressionImageElementComponent";

// Single entry point: picks the variant from `mode`, so callers (and any other
// renderer importing this) keep using one component.
export const ImageElementComponent = (props: Props): React.ReactElement =>
  props.element.props.mode === "expression" ? (
    <ExpressionImageElementComponent {...props} />
  ) : (
    <PlainImageElementComponent {...props} />
  );
