import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { MediaContentStepType, MediaContentStepTypeSchema } from "./types";
import { View, Text, StyleSheet, Image, ScrollView } from "react-native";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";

type ContentProps = {
  step: MediaContentStepType;
  onContinue: () => void;
  theme?: Theme;
};

const MediaContentRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  // Validate the schema
  const validatedData = MediaContentStepTypeSchema.parse(step);
  const { mediaSource, title, description } = validatedData.payload;

  const renderMedia = () => {
    if (mediaSource.type === "image") {
      // Check if it's a local path or URL
      if ("localPathId" in mediaSource) {
        // TODO: Map localPathId to actual local image path
        return (
          <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
            <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>
              Image: {mediaSource.localPathId}
            </Text>
          </View>
        );
      } else if ("url" in mediaSource) {
        return (
          <Image
            source={{ uri: mediaSource.url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        );
      }
    } else if (mediaSource.type === "lottie") {
      // TODO: Implement Lottie animation support
      return (
        <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Lottie Animation</Text>
        </View>
      );
    } else if (mediaSource.type === "rive") {
      // Rive animation placeholder
      return (
        <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Rive Animation</Text>
        </View>
      );
    }

    return (
      <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
        <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Media</Text>
      </View>
    );
  };

  return (
    <OnboardingTemplate
      step={step}
      onContinue={onContinue}
      theme={theme}
      button={{ text: validatedData.continueButtonLabel }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.container}>
          {/* Title */}
          <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>

          {/* Media Content */}
          <View style={styles.mediaContainer}>{renderMedia()}</View>

          {/* Description/Subtitle */}
          {description && <Text style={[getTextStyle(theme, "heading3"), styles.subtitle, { color: theme.colors.text.secondary }]}>{description}</Text>}
        </View>
      </ScrollView>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 24,
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.76,
  },
  mediaContainer: {
    width: "100%",
    height: 400,
    borderRadius: 32,
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {},
  subtitle: {
    textAlign: "center",
  },
});

import { withErrorBoundary } from '../../ErrorBoundary';

export const MediaContentRenderer = withErrorBoundary(MediaContentRendererBase, 'MediaContent');
