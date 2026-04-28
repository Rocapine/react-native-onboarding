import React from "react";
import { View } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";

export type ZStackElementProps = BaseBoxProps;
export const ZStackElementPropsSchema = BaseBoxPropsSchema;

type ZStackUIElement = Extract<UIElement, { type: "ZStack" }>;

type Props = {
  element: ZStackUIElement;
  ctx: RenderContext;
};

export const ZStackElementComponent = ({ element, ctx }: Props): React.ReactElement => {
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
      }}
    >
      {element.children.map((child) => (
        <View key={child.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          {ctx.renderChildren([child], "ZStack")}
        </View>
      ))}
    </GradientBox>
  );
};
