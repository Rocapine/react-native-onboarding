import React from "react";
import { z } from "zod";
import { Image } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext } from "./shared";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
};

export const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
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
  const aspectRatio = hasExplicitHeight ? undefined : (element.props.aspectRatio ?? 16 / 9);

  return (
    <Image
      source={{ uri: element.props.url }}
      resizeMode={element.props.resizeMode ?? "cover"}
      style={{
        width: element.props.width ?? "100%",
        height: element.props.height,
        aspectRatio,
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
      }}
    />
  );
};
