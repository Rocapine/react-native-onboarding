import React from "react";
import { z } from "zod";
import { View, Text, StyleSheet } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { getTextStyle } from "../../../Theme/helpers";

export type LottieElementProps = BaseBoxProps & {
  source: string;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
};

export const LottieElementPropsSchema = BaseBoxPropsSchema.extend({
  source: z.string().min(1, "source must not be empty"),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  speed: z.number().optional(),
});

type LottieUIElement = Extract<UIElement, { type: "Lottie" }>;

let LottieView: React.ComponentType<{
  source: string | object;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: object;
}> | null = null;
try {
  LottieView = require("lottie-react-native").default;
} catch {
  // lottie-react-native not installed
}

type Props = {
  element: LottieUIElement;
  ctx: RenderContext;
};

export const LottieElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const wrapperStyle = {
    flex: element.props.flex,
    flexShrink: element.props.flexShrink,
    flexGrow: element.props.flexGrow,
    alignSelf: element.props.alignSelf,
    width: dim(element.props.width) ?? ("100%" as `${number}%`),
    height: dim(element.props.height ?? 200),
    minWidth: element.props.minWidth,
    maxWidth: element.props.maxWidth,
    minHeight: element.props.minHeight,
    maxHeight: element.props.maxHeight,
    opacity: element.props.opacity,
    backgroundColor: element.props.backgroundColor,
    margin: element.props.margin,
    marginHorizontal: element.props.marginHorizontal,
    marginVertical: element.props.marginVertical,
    padding: element.props.padding,
    paddingHorizontal: element.props.paddingHorizontal,
    paddingVertical: element.props.paddingVertical,
    borderWidth: element.props.borderWidth,
    borderRadius: element.props.borderRadius,
    borderColor: element.props.borderColor,
    overflow: "hidden" as const,
  };

  if (!LottieView) {
    return (
      <View style={[wrapperStyle, styles.mediaFallback, { backgroundColor: theme.colors.neutral.lowest }]}>
        <Text style={[styles.mediaFallbackText, getTextStyle(theme, "caption"), { color: theme.colors.text.tertiary }]}>
          Install lottie-react-native to render Lottie animations.
        </Text>
      </View>
    );
  }

  return (
    <View style={wrapperStyle}>
      <LottieView
        source={{ uri: element.props.source }}
        autoPlay={element.props.autoPlay ?? true}
        loop={element.props.loop ?? true}
        speed={element.props.speed}
        style={styles.fill}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    width: "100%",
    height: "100%",
  },
  mediaFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  mediaFallbackText: {
    textAlign: "center",
    paddingHorizontal: 16,
  },
});
