import React from "react";
import { z } from "zod";
import { Image } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
};

export const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
});

type ImageUIElement = Extract<UIElement, { type: "Image" }>;

type Props = {
  element: ImageUIElement;
  ctx: RenderContext;
};

export const ImageElementComponent = ({ element }: Props): React.ReactElement => {
  const hasExplicitHeight = element.props.height !== undefined;

  return (
    <Image
      source={{ uri: element.props.url }}
      resizeMode={element.props.resizeMode}
      style={({
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
        backgroundColor: element.props.backgroundColor,
        overflow: element.props.overflow,
        borderRadius: element.props.borderRadius,
        borderWidth: element.props.borderWidth,
        borderColor: element.props.borderColor,
        opacity: element.props.opacity,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        padding: element.props.padding,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
      }) as any}
    />
  );
};
