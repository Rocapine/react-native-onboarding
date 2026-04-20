import React from "react";
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";

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
  // lottie-react-native not installed - will show error if Lottie is used
}

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
  theme?: Theme;
};

const renderElement = (element: UIElement, theme: Theme, parentType?: "XStack" | "YStack"): React.ReactNode => {
  if (element.type === "YStack" || element.type === "XStack") {
    return (
      <View
        key={element.id}
        style={{
          flexDirection: element.type === "XStack" ? "row" : "column",
          gap: element.props.gap,
          padding: element.props.padding,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          flex: element.props.flex,
          width: element.props.width,
          height: element.props.height,
          minWidth: element.props.minWidth,
          maxWidth: element.props.maxWidth,
          minHeight: element.props.minHeight,
          maxHeight: element.props.maxHeight,
          flexShrink: element.props.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
          flexWrap: element.props.flexWrap,
          alignItems: element.props.alignItems,
          justifyContent: element.props.justifyContent,
          backgroundColor: element.props.backgroundColor,
          borderWidth: element.props.borderWidth,
          borderRadius: element.props.borderRadius,
          borderColor: element.props.borderColor,
          overflow: element.props.overflow,
          opacity: element.props.opacity,
        }}
      >
        {element.children.map((child) => renderElement(child, theme, element.type))}
      </View>
    );
  }

  if (element.type === "Text") {
    return (
      <Text
        key={element.id}
        style={{
          fontSize: element.props.fontSize,
          fontWeight: element.props.fontWeight as any,
          color: element.props.color ?? theme.colors.text.primary,
          textAlign: element.props.textAlign,
          letterSpacing: element.props.letterSpacing,
          lineHeight: element.props.lineHeight,
          backgroundColor: element.props.backgroundColor,
          padding: element.props.padding,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          borderWidth: element.props.borderWidth,
          borderRadius: element.props.borderRadius,
          borderColor: element.props.borderColor,
          opacity: element.props.opacity,
          flexShrink: parentType === "XStack" ? 1 : undefined,
        }}
      >
        {element.props.content}
      </Text>
    );
  }

  if (element.type === "Image") {
    const hasExplicitHeight = element.props.height !== undefined;
    const aspectRatio = hasExplicitHeight
      ? undefined
      : (element.props.aspectRatio ?? 16 / 9);
    return (
      <Image
        key={element.id}
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
  }

  if (element.type === "Lottie") {
    const lottieStyle = {
      width: element.props.width ?? ("100%" as `${number}%`),
      height: element.props.height ?? 200,
      opacity: element.props.opacity,
      margin: element.props.margin,
      marginHorizontal: element.props.marginHorizontal,
      marginVertical: element.props.marginVertical,
    };

    if (!LottieView) {
      return (
        <View
          key={element.id}
          style={[lottieStyle, styles.lottieFallback]}
        >
          <Text style={styles.lottieFallbackText}>
            Install lottie-react-native to render Lottie animations.
          </Text>
        </View>
      );
    }

    return (
      <LottieView
        key={element.id}
        // source={element.props.source}
        source={{ uri: element.props.source }}
        autoPlay={element.props.autoPlay ?? true}
        loop={element.props.loop ?? true}
        speed={element.props.speed}
        style={lottieStyle}
      />
    );
  }

  return null;
};

const ComposableScreenRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const validatedData = ComposableScreenStepTypeSchema.parse(step);
  const { elements } = validatedData.payload;
  return (
    <OnboardingTemplate
      step={step}
      onContinue={onContinue}
      theme={theme}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        {elements.map((element) => renderElement(element, theme))}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: theme.colors.primary }]}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text
              style={[
                getTextStyle(theme, "button"),
                { color: theme.colors.text.opposite },
              ]}
            >
              {validatedData.continueButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </OnboardingTemplate>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomSection: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  ctaButton: {
    borderRadius: 90,
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 234,
    alignItems: "center",
  },
  lottieFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  lottieFallbackText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 16,
  },
});

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");
