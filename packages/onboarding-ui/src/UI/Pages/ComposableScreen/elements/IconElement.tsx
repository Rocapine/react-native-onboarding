import React from "react";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";

export type IconElementProps = BaseBoxProps & {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  backgroundColor?: string;
};

export const IconElementPropsSchema = BaseBoxPropsSchema.extend({
  name: z.string().min(1, "icon name must not be empty"),
  size: z.number().nonnegative().optional(),
  color: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  backgroundColor: z.string().optional(),
});

type IconUIElement = Extract<UIElement, { type: "Icon" }>;

type Props = {
  element: IconUIElement;
  ctx: RenderContext;
};

export const IconElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const icons = require("lucide-react-native");
  const IconComp = icons[element.props.name] as React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }> | undefined;

  return (
    <GradientBox
      gradient={element.props.backgroundGradient}
      style={{
        flex: element.props.flex,
        flexShrink: element.props.flexShrink,
        flexGrow: element.props.flexGrow,
        alignSelf: element.props.alignSelf,
        width: dim(element.props.width),
        height: dim(element.props.height),
        minWidth: element.props.minWidth,
        maxWidth: element.props.maxWidth,
        minHeight: element.props.minHeight,
        maxHeight: element.props.maxHeight,
        overflow: element.props.overflow,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        padding: element.props.padding,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
        borderWidth: element.props.borderWidth,
        borderRadius: element.props.borderRadius,
        borderColor: element.props.borderColor,
        backgroundColor: element.props.backgroundGradient ? undefined : element.props.backgroundColor,
        opacity: element.props.opacity,
      }}
    >
      {IconComp ? (
        <IconComp
          size={element.props.size ?? 24}
          color={element.props.color ?? theme.colors.text.primary}
          strokeWidth={element.props.strokeWidth ?? 2}
        />
      ) : null}
    </GradientBox>
  );
};
