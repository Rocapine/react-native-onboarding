import React from "react";
import { z } from "zod";
import { Image } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";

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

  const p = element.props;

  if (p.backgroundGradient) {
    return (
      <GradientBox
        gradient={p.backgroundGradient}
        style={{
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
          overflow: (p.overflow ?? "hidden") as any,
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
        }}
      >
        <Image
          source={{ uri: p.url }}
          resizeMode={p.resizeMode}
          style={{ width: "100%", height: "100%" }}
        />
      </GradientBox>
    );
  }

  return (
    <Image
      source={{ uri: p.url }}
      resizeMode={p.resizeMode}
      style={({
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
      }) as any}
    />
  );
};
