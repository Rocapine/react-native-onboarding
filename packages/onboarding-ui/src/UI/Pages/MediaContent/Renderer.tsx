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
  const { mediaSource, title, description, layoutStyle = "default" } = validatedData.payload;

  const renderMedia = () => {
    if (mediaSource.type === "image") {
      if ("localPathId" in mediaSource) {
        return (
          <View style={[styles.mediaContainer, styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
            <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>
              Image: {mediaSource.localPathId}
            </Text>
          </View>
        );
      } else if ("url" in mediaSource) {
        return (
          <View style={styles.mediaContainer}>
            <Image source={{ uri: mediaSource.url }} style={styles.mediaImage} resizeMode="cover" />
          </View>
        );
      }
    } else if (mediaSource.type === "lottie") {
      return (
        <View style={[styles.mediaContainer, styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Lottie Animation</Text>
        </View>
      );
    } else if (mediaSource.type === "rive") {
      return (
        <View style={[styles.mediaContainer, styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Rive Animation</Text>
        </View>
      );
    }

    return (
      <View style={[styles.mediaContainer, styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
        <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Media</Text>
      </View>
    );
  };

  const renderTextBlock = () => (
    <>
      <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
      {description && <Text style={[getTextStyle(theme, "heading3"), styles.subtitle, { color: theme.colors.text.secondary }]}>{description}</Text>}
    </>
  );

  const renderContent = () => {
    switch (layoutStyle) {
      case "media_bottom":
        return (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            <View style={[styles.container, styles.containerSpaceBetween]}>
              <View style={styles.textBlock}>{renderTextBlock()}</View>
              <View style={styles.flexSpacer} />
              {renderMedia()}
            </View>
          </ScrollView>
        );

      case "media_top":
        return (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            <View style={styles.container}>
              {renderMedia()}
              {renderTextBlock()}
            </View>
          </ScrollView>
        );

      case "default":
      default:
        return (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            <View style={[styles.container, styles.containerCenter]}>
              <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
              {renderMedia()}
              {description && (
                <Text style={[getTextStyle(theme, "heading3"), styles.subtitle, { color: theme.colors.text.secondary }]}>
                  {description}
                </Text>
              )}
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <OnboardingTemplate
      step={step}
      onContinue={onContinue}
      theme={theme}
      button={{
        text: validatedData.buttonSection?.label?.trim() || validatedData.continueButtonLabel,
        icon: validatedData.buttonSection?.icon?.trim() || null,
      }}
    >
      {renderContent()}
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
  containerCenter: {
    justifyContent: "center",
  },
  containerSpaceBetween: {
    justifyContent: "flex-start",
    paddingTop: 32,
  },
  flexSpacer: {
    flex: 0.4,
  },
  textBlock: {
    gap: 8,
    alignItems: "center",
    width: "100%",
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.76,
  },
  mediaContainer: {
    width: "100%",
    aspectRatio: 1,
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
