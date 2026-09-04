import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingHeaderHeight } from "@rocapine/react-native-onboarding";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { GradientBox } from "./GradientBox";
import { UIElement } from "../types";
import { RenderContext, dim, areElementPropsEqual } from "./shared";
import { fillLayout, fillsParent } from "./wrapperLayout";

export type SafeAreaEdge = "top" | "right" | "bottom" | "left";
export type SafeAreaEdgeMode = "off" | "additive" | "maximum";

export type SafeAreaViewElementProps = BaseBoxProps & {
  mode?: "padding" | "margin";
  edges?: SafeAreaEdge[] | Partial<Record<SafeAreaEdge, SafeAreaEdgeMode>>;
};

const EdgeSchema = z.enum(["top", "right", "bottom", "left"]);
const EdgeModeSchema = z.enum(["off", "additive", "maximum"]);

export const SafeAreaViewElementPropsSchema = BaseBoxPropsSchema.extend({
  mode: z.enum(["padding", "margin"]).optional(),
  edges: z
    .union([
      z.array(EdgeSchema),
      z.object({
        top: EdgeModeSchema.optional(),
        right: EdgeModeSchema.optional(),
        bottom: EdgeModeSchema.optional(),
        left: EdgeModeSchema.optional(),
      }),
    ])
    .optional(),
});

type SafeAreaViewUIElement = Extract<UIElement, { type: "SafeAreaView" }>;

type Props = {
  element: SafeAreaViewUIElement;
  ctx: RenderContext;
};

/**
 * Does this element apply the top safe-area inset itself? Plain SafeAreaView
 * defaults to all edges when `edges` is omitted; otherwise top is active when
 * the array includes "top" or the object's `top` mode isn't "off".
 */
const appliesTopEdge = (
  edges: SafeAreaViewElementProps["edges"]
): boolean => {
  if (edges == null) return true;
  if (Array.isArray(edges)) return edges.includes("top");
  return edges.top != null && edges.top !== "off";
};

const SafeAreaViewElementComponentBase = ({ element, ctx }: Props): React.ReactElement => {
  const p = element.props;
  const hasGradient = !!p.backgroundGradient;

  // Offset content below the host-rendered ProgressBar (absolute-positioned, so
  // it doesn't take layout space). `headerHeight` is the bar's full footprint
  // incl. the top inset it spans. When this SafeAreaView already applies the top
  // inset, only add the overlap beyond it (headerHeight - inset); otherwise add
  // the whole footprint. 0 when the bar is hidden. NOTE: only the screen's
  // top-most SafeAreaView should carry this — a nested top-edge SafeAreaView
  // would double-offset (same caveat as nesting safe-area insets in general).
  const { headerHeight } = useOnboardingHeaderHeight();
  const insets = useSafeAreaInsets();
  const headerOffset =
    headerHeight === 0
      ? 0
      : appliesTopEdge(p.edges)
        ? Math.max(0, headerHeight - insets.top)
        : headerHeight;
  const frameStyle = {
    flex: p.flex,
    flexShrink: p.flexShrink,
    flexGrow: p.flexGrow,
    alignSelf: p.alignSelf,
    width: dim(p.width),
    height: dim(p.height),
    minWidth: p.minWidth,
    maxWidth: p.maxWidth,
    minHeight: p.minHeight,
    maxHeight: p.maxHeight,
    margin: p.margin,
    marginHorizontal: p.marginHorizontal,
    marginVertical: p.marginVertical,
    backgroundColor: hasGradient ? undefined : p.backgroundColor,
    borderWidth: p.borderWidth,
    borderRadius: p.borderRadius,
    borderColor: p.borderColor,
    overflow: hasGradient ? "hidden" as const : p.overflow,
    opacity: p.opacity,
  };

  // When gradient is present the outer GradientBox carries the box layout
  // (frameStyle) and the inner SafeAreaView fills it — but only force `flex: 1`
  // when the box is explicitly sized (height/flex). A content-sized box must
  // stay content-sized, else `flex: 1` grabs the parent's full main-axis (e.g.
  // inside a ZStack the element fills the whole screen).
  const fills = fillsParent(p);
  // Stack the bar offset on top of the author's existing top padding. paddingTop
  // is more specific than padding/paddingVertical, so re-add the base it shadows.
  const baseTopPadding = p.padding ?? p.paddingVertical;
  const safeAreaStyle = {
    // Gradient path only: this inner SafeAreaView fills the GradientBox that
    // carries `frameStyle`, and it fills with `flexGrow`/`flexShrink` — a
    // `flex: 1` here measures 0 inside a content-sized outer (#231). In the
    // non-gradient path this style is merged OVER `frameStyle` on the one box,
    // which already carries all three flex keys, so it must add nothing:
    // restating `flex` there overrode one of the three with the same value and
    // read as if the two disagreed.
    ...(hasGradient ? fillLayout(fills) : {}),
    padding: p.padding,
    paddingHorizontal: p.paddingHorizontal,
    paddingVertical: p.paddingVertical,
    ...(headerOffset > 0
      ? { paddingTop: headerOffset + (baseTopPadding ?? 0) }
      : null),
  };

  if (hasGradient) {
    return (
      <GradientBox gradient={p.backgroundGradient} style={frameStyle}>
        <SafeAreaView mode={p.mode} edges={p.edges as any} style={safeAreaStyle}>
          {ctx.renderChildren(element.children, "YStack")}
        </SafeAreaView>
      </GradientBox>
    );
  }

  return (
    <SafeAreaView
      mode={p.mode}
      edges={p.edges as any}
      style={{ ...frameStyle, ...safeAreaStyle }}
    >
      {ctx.renderChildren(element.children, "YStack")}
    </SafeAreaView>
  );
};

export const SafeAreaViewElementComponent = React.memo(SafeAreaViewElementComponentBase, areElementPropsEqual);
