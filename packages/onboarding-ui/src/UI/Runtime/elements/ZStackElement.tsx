import React from "react";
import { View } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim, buildShadowStyle, areElementPropsEqual } from "./shared";
import { GradientBox } from "./GradientBox";

export type ZStackElementProps = BaseBoxProps & {
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
};
export const ZStackElementPropsSchema = BaseBoxPropsSchema.extend({
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch", "baseline"]).optional(),
});

type ZStackUIElement = Extract<UIElement, { type: "ZStack" }>;

type Props = {
  element: ZStackUIElement;
  ctx: RenderContext;
};

const ZStackElementComponentBase = ({ element, ctx }: Props): React.ReactElement => {
  const p = element.props;
  return (
    <GradientBox
      gradient={p.backgroundGradient}
      style={{
        position: "relative",
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
        padding: p.padding,
        paddingHorizontal: p.paddingHorizontal,
        paddingVertical: p.paddingVertical,
        margin: p.margin,
        marginHorizontal: p.marginHorizontal,
        marginVertical: p.marginVertical,
        backgroundColor: p.backgroundGradient ? undefined : p.backgroundColor,
        borderWidth: p.borderWidth,
        borderRadius: p.borderRadius,
        borderColor: p.borderColor,
        overflow: p.overflow,
        opacity: p.opacity,
        ...buildShadowStyle(p),
      }}
    >
      {element.children.map((child) => {
        // `inset` is declarative absolute placement, honoured only here because
        // ZStack is the only container that absolutely-positions its children.
        const inset = child.props?.inset;
        // The wrapper is flexDirection:column, so `justifyContent` drives the
        // VERTICAL axis and `alignItems` the HORIZONTAL one.
        const pinnedV = inset?.top !== undefined || inset?.bottom !== undefined;
        const pinnedH = inset?.left !== undefined || inset?.right !== undefined;

        return (
          <View
            key={child.id}
            pointerEvents="box-none"
            style={{
              position: "absolute",
              // An axis with an inset uses ONLY the sides given. Keeping the
              // opposite side's 0 would leave the wrapper full-bleed on that
              // axis, and the shared anchor would then re-center the child
              // inside it — placement would look correct at `flex-start` and be
              // wrong at every other anchor. Dropping both the opposite 0 and
              // the anchor leaves the wrapper content-sized and corner-pinned,
              // which is what a drag-to-place gesture means. Supplying both
              // sides of an axis resolves to a size instead, and stretches.
              // `dim()` casts the number|percentage-string union to RN's DimensionValue.
              top: dim(pinnedV ? inset?.top : 0),
              bottom: dim(pinnedV ? inset?.bottom : 0),
              left: dim(pinnedH ? inset?.left : 0),
              right: dim(pinnedH ? inset?.right : 0),
              // Anchor a content-sized child within the full-bleed stack (e.g. a
              // floating bottom CTA with `justifyContent: "flex-end"`). A child
              // that fills (flex/height) ignores these; the wrapper stays
              // box-none so scroll content layered behind still receives touches.
              // Skipped per-axis when that axis is explicitly positioned, so a
              // partial inset still inherits the anchor on the other axis.
              justifyContent: pinnedV ? undefined : p.justifyContent,
              alignItems: pinnedH ? undefined : p.alignItems,
            }}
          >
            {ctx.renderChildren([child], "ZStack")}
          </View>
        );
      })}
    </GradientBox>
  );
};

export const ZStackElementComponent = React.memo(ZStackElementComponentBase, areElementPropsEqual);
