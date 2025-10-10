import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { CommitmentStepType, CommitmentStepTypeSchema } from "./types";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";

// Lazy load Skia - only needed for signature variant
let SkiaModule: any;
try {
  SkiaModule = require("@shopify/react-native-skia");
} catch (e) {
  // Skia not installed - will show error if signature variant is used
  SkiaModule = null;
}

type ContentProps = {
  step: CommitmentStepType;
  onContinue: () => void;
  theme?: Theme;
};

const CommitmentRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const validatedData = CommitmentStepTypeSchema.parse(step);
  const { payload } = validatedData;

  // Check if Skia is needed and available
  const needsSkia = payload.variant === "signature";
  if (needsSkia && !SkiaModule) {
    throw new Error(
      "Commitment screens with signature variant require @shopify/react-native-skia. Install it with: npm install @shopify/react-native-skia"
    );
  }

  const Skia = SkiaModule?.Skia;
  const currentPath = useRef<any>(null);
  const [paths, setPaths] = useState<any[]>([]);
  const [hasSignature, setHasSignature] = useState(false);

  const updatePaths = useCallback((newPath: any) => {
    setPaths((prevState) => [...prevState, newPath]);
  }, []);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(({ x, y }: { x: number; y: number }) => {
      if (Skia) {
        currentPath.current = Skia.Path.Make();
        currentPath.current.moveTo(x, y);
        runOnJS(updatePaths)(currentPath.current);
        runOnJS(setHasSignature)(true);
      }
    })
    .onUpdate(({ x, y }: { x: number; y: number }) => {
      if (currentPath.current) {
        currentPath.current.lineTo(x, y);
        setPaths((prev) => [...prev]);
      }
    });

  const handleClearSignature = () => {
    setPaths([]);
    currentPath.current = null;
    setHasSignature(false);
  };

  const isButtonDisabled = payload.variant === "signature" && !hasSignature;

  return (
    <OnboardingTemplate
      step={validatedData}
      onContinue={onContinue}
      theme={theme}
      button={{
        text: validatedData.continueButtonLabel,
        disabled: isButtonDisabled,
      }}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.container}>
          {/* Title */}
          <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>
            {payload.title}
          </Text>

          {/* Content Section */}
          <View style={styles.contentSection}>
            {/* Subtitle */}
            {payload.subtitle && (
              <Text
                style={[
                  getTextStyle(theme, "heading3"),
                  styles.subtitle,
                  { color: theme.colors.text.secondary },
                ]}
              >
                {payload.subtitle}
              </Text>
            )}

            {/* Description or Commitments List */}
            {payload.description ? (
              <Text
                style={[
                  getTextStyle(theme, "body"),
                  styles.description,
                  { color: theme.colors.text.secondary },
                ]}
              >
                {payload.description}
              </Text>
            ) : (
              payload.commitments && (
                <View style={styles.commitmentsContainer}>
                  {payload.commitments.map(
                    (commitment: { text: string }, index: number) => (
                      <View key={index} style={styles.commitmentRow}>
                        <View
                          style={[
                            styles.checkmark,
                            { backgroundColor: theme.colors.primary },
                          ]}
                        >
                          <Text style={[styles.checkmarkText, { color: theme.colors.text.opposite }]}>✓</Text>
                        </View>
                        <Text
                          style={[
                            getTextStyle(theme, "body"),
                            styles.commitmentText,
                            { color: theme.colors.text.secondary },
                          ]}
                        >
                          {commitment.text}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              )
            )}
          </View>

          {/* Signature Canvas */}
          {payload.variant === "signature" && (
            <View style={styles.signatureSection}>
              <GestureHandlerRootView style={styles.gestureRoot}>
                <View
                  style={[
                    styles.signatureContainer,
                    { borderColor: theme.colors.primary },
                  ]}
                >
                  {/* Clear button */}
                  {hasSignature && (
                    <TouchableOpacity
                      style={[
                        styles.clearButton,
                        { backgroundColor: theme.colors.neutral.higher },
                      ]}
                      onPress={handleClearSignature}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.clearButtonText, { color: theme.colors.text.opposite }]}>✕</Text>
                    </TouchableOpacity>
                  )}

                  {/* Canvas */}
                  <GestureDetector gesture={panGesture}>
                    {SkiaModule && (
                      <SkiaModule.Canvas style={styles.canvas}>
                        {paths.map((path: any, index: number) => (
                          <SkiaModule.Path
                            key={index}
                            path={path}
                            color={theme.colors.text.primary}
                            style="stroke"
                            strokeWidth={2}
                            strokeCap="round"
                            strokeJoin="round"
                          />
                        ))}
                      </SkiaModule.Canvas>
                    )}
                  </GestureDetector>
                </View>
              </GestureHandlerRootView>

              {/* Caption */}
              <Text
                style={[
                  getTextStyle(theme, "caption"),
                  styles.signatureCaption,
                  { color: theme.colors.text.secondary },
                ]}
              >
                {payload.signatureCaption}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 48,
  },
  title: {
    letterSpacing: -0.76,
  },
  contentSection: {
    gap: 24,
  },
  subtitle: {},
  description: {
    paddingVertical: 8,
  },
  commitmentsContainer: {
    gap: 16,
  },
  commitmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  checkmarkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  commitmentText: {
    flex: 1,
  },
  signatureSection: {
    gap: 8,
  },
  gestureRoot: {
    width: "100%",
  },
  signatureContainer: {
    borderWidth: 2,
    borderRadius: 32,
    padding: 12,
    height: 169,
    position: "relative",
  },
  clearButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "400",
  },
  canvas: {
    flex: 1,
    borderRadius: 20,
  },
  signatureCaption: {
    marginBottom: 32,
  },
});

import { withErrorBoundary } from "../../ErrorBoundary";

export const CommitmentRenderer = withErrorBoundary(
  CommitmentRendererBase,
  "Commitment"
);
