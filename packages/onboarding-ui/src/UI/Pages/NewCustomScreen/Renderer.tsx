import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewCustomScreenStepType, NewCustomScreenStepTypeSchema, UIElement } from "./types";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";

type ContentProps = {
  step: NewCustomScreenStepType;
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
          flex: element.props.flex,
          flexShrink: element.props.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
          flexWrap: element.props.flexWrap,
          alignItems: element.props.alignItems,
          justifyContent: element.props.justifyContent,
          backgroundColor: element.props.backgroundColor,
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
          flexShrink: parentType === "XStack" ? 1 : undefined,
        }}
      >
        {element.props.content}
      </Text>
    );
  }

  return null;
};

const NewCustomScreenRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const { top, bottom } = useSafeAreaInsets();
  const validatedData = NewCustomScreenStepTypeSchema.parse(step);
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
});

import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";

export const NewCustomScreenRenderer = withErrorBoundary(NewCustomScreenRendererBase, "NewCustomScreen");
