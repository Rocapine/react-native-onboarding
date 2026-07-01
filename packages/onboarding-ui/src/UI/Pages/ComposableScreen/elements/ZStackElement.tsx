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
      {element.children.map((child) => (
        <View
          key={child.id}
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Anchor a content-sized child within the full-bleed stack (e.g. a
            // floating bottom CTA with `justifyContent: "flex-end"`). A child
            // that fills (flex/height) ignores these; the wrapper stays
            // box-none so scroll content layered behind still receives touches.
            justifyContent: p.justifyContent,
            alignItems: p.alignItems,
          }}
        >
          {ctx.renderChildren([child], "ZStack")}
        </View>
      ))}
    </GradientBox>
  );
};

export const ZStackElementComponent = React.memo(ZStackElementComponentBase, areElementPropsEqual);
