import React from "react";
import { z } from "zod";
import { View, Text, StyleSheet } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext } from "./shared";
import { getTextStyle } from "../../../Theme/helpers";

export type RiveElementProps = BaseBoxProps & {
  url: string;
  autoplay?: boolean;
  fit?: "Contain" | "Cover" | "Fill" | "FitWidth" | "FitHeight" | "None" | "ScaleDown" | "Layout";
  alignment?: "TopLeft" | "TopCenter" | "TopRight" | "CenterLeft" | "Center" | "CenterRight" | "BottomLeft" | "BottomCenter" | "BottomRight";
  artboardName?: string;
  stateMachineName?: string;
};

export const RiveElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  autoplay: z.boolean().optional(),
  fit: z.enum(["Contain", "Cover", "Fill", "FitWidth", "FitHeight", "None", "ScaleDown", "Layout"]).optional(),
  alignment: z.enum(["TopLeft", "TopCenter", "TopRight", "CenterLeft", "Center", "CenterRight", "BottomLeft", "BottomCenter", "BottomRight"]).optional(),
  artboardName: z.string().optional(),
  stateMachineName: z.string().optional(),
});

type RiveUIElement = Extract<UIElement, { type: "Rive" }>;

let RiveElementComponent: React.ComponentType<{ element: RiveUIElement; riveStyle: object }> | null = null;
try {
  const riveModule = require("rive-react-native");
  const Rive = riveModule.default;
  const { Fit, Alignment } = riveModule;
  RiveElementComponent = ({ element, riveStyle }: { element: RiveUIElement; riveStyle: object }) => {
    return (
      <Rive
        url={element.props.url}
        autoplay={element.props.autoplay ?? true}
        fit={element.props.fit ? Fit[element.props.fit] : Fit.Contain}
        alignment={element.props.alignment ? Alignment[element.props.alignment] : Alignment.Center}
        artboardName={element.props.artboardName}
        stateMachineName={element.props.stateMachineName}
        style={riveStyle}
        onError={console.error}
      />
    );
  };
} catch {
  // rive-react-native not installed - will show fallback if Rive is used
}

type Props = {
  element: RiveUIElement;
  ctx: RenderContext;
};

export const RiveElementRenderer = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const wrapperStyle = {
    width: element.props.width ?? ("100%" as `${number}%`),
    height: element.props.height ?? 200,
    opacity: element.props.opacity,
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

  if (!RiveElementComponent) {
    return (
      <View style={[wrapperStyle, styles.mediaFallback, { backgroundColor: theme.colors.neutral.lowest }]}>
        <Text style={[styles.mediaFallbackText, getTextStyle(theme, "caption"), { color: theme.colors.text.tertiary }]}>
          Install rive-react-native to render Rive animations.
        </Text>
      </View>
    );
  }

  return (
    <View style={wrapperStyle}>
      <RiveElementComponent element={element} riveStyle={styles.fill} />
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
