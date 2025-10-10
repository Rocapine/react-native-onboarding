import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { LoaderStepType, LoaderStepTypeSchema, LoaderStep } from "./types";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ScrollView,
  useWindowDimensions,
  Image,
} from "react-native";
import { useRef, useEffect, useState, useCallback } from "react";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { CircularProgress } from "../../Components/CircularProgress";
import { StaggeredTextList } from "../../Components/StaggeredTextList";

type ContentProps = {
  step: LoaderStepType;
  onContinue: () => void;
  theme?: Theme;
};

const LoaderRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const validatedData = LoaderStepTypeSchema.parse(step);
  const { title, steps, didYouKnowImages, duration, variant } =
    validatedData.payload;

  // Route to appropriate variant
  if (variant === "circle") {
    return (
      <CircleVariant
        step={step}
        onContinue={onContinue}
        validatedData={validatedData}
        theme={theme}
      />
    );
  }

  // Default to bars variant
  return (
    <BarsVariant
      step={step}
      onContinue={onContinue}
      validatedData={validatedData}
      theme={theme}
    />
  );
};

// Bars Variant (original implementation)
const BarsVariant = ({
  step,
  onContinue,
  validatedData,
  theme,
}: {
  step: LoaderStepType;
  onContinue: () => void;
  validatedData: LoaderStepType;
  theme: Theme;
}) => {
  const { title, steps, didYouKnowImages, duration } = validatedData.payload;

  const [isComplete, setIsComplete] = useState(false);
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;

  // Create animated values for each step
  const progressValues = useRef(steps.map(() => new Animated.Value(0))).current;

  const handleAnimationComplete = useCallback(() => {
    setIsComplete(true);
    Animated.timing(buttonFadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [buttonFadeAnim]);

  useEffect(() => {
    // Animate each step sequentially
    const animations = progressValues.map((progress, index) =>
      Animated.timing(progress, {
        toValue: 1,
        duration: duration,
        delay: (index * duration) / 2,
        useNativeDriver: false,
      })
    );

    Animated.sequence(animations).start(() => {
      handleAnimationComplete();
    });
  }, [progressValues, duration, handleAnimationComplete]);

  const styles = createStyles(theme);

  return (
    <OnboardingTemplate
      step={step}
      onContinue={onContinue}
      theme={theme}
      button={
        isComplete ? { text: validatedData.continueButtonLabel } : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {steps.map((stepItem, index) => (
              <StepProgress
                key={index}
                step={stepItem}
                progress={progressValues[index]}
                theme={theme}
              />
            ))}
          </View>

          {/* Did you know carousel */}
          {didYouKnowImages && didYouKnowImages.length > 0 && (
            <View style={styles.carouselSection}>
              <Text style={styles.carouselTitle}>Did you know?</Text>
              <DidYouKnowCarousel images={didYouKnowImages} theme={theme} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Animated button */}
      {isComplete && (
        <Animated.View
          style={[styles.buttonContainer, { opacity: buttonFadeAnim }]}
        />
      )}
    </OnboardingTemplate>
  );
};

// Circle Variant
const CircleVariant = ({
  step,
  onContinue,
  validatedData,
  theme,
}: {
  step: LoaderStepType;
  onContinue: () => void;
  validatedData: LoaderStepType;
  theme: Theme;
}) => {
  const { title, steps, didYouKnowImages, duration } = validatedData.payload;

  const handleAnimationComplete = useCallback(() => {
    onContinue();
  }, [onContinue]);

  const styles = createStyles(theme);

  return (
    <OnboardingTemplate step={step} onContinue={onContinue} theme={theme}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Circular Progress */}
          <View style={styles.circleSection}>
            <CircularProgress
              onProgressComplete={handleAnimationComplete}
              duration={duration}
              totalSteps={steps.length}
            />
          </View>

          {/* Staggered Text List */}
          <View style={styles.textListSection}>
            <StaggeredTextList items={steps} duration={duration} />
          </View>

          {/* Did you know carousel */}
          {didYouKnowImages && didYouKnowImages.length > 0 && (
            <View style={styles.carouselSection}>
              <Text style={styles.carouselTitle}>Did you know?</Text>
              <DidYouKnowCarousel images={didYouKnowImages} theme={theme} />
            </View>
          )}
        </View>
      </ScrollView>
    </OnboardingTemplate>
  );
};

type StepProgressProps = {
  step: LoaderStep;
  progress: Animated.Value;
  theme: Theme;
};

const StepProgress = ({ step, progress, theme }: StepProgressProps) => {
  const [barStarted, setBarStarted] = useState(false);
  const [barComplete, setBarComplete] = useState(false);
  const styles = createStyles(theme);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      if (value > 0 && !barStarted) {
        setBarStarted(true);
      }
      if (value >= 1 && !barComplete) {
        setBarComplete(true);
      }
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress, barStarted, barComplete]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const textColor = barStarted
    ? theme.colors.text.secondary
    : theme.colors.text.disable;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepLabel, { color: textColor }]}>
          {barComplete ? step.completed : step.label}
        </Text>
        {barComplete ? (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        ) : (
          <View style={styles.checkmarkPlaceholder} />
        )}
      </View>
      <View style={styles.progressBar}>
        <Animated.View
          style={[styles.progressFill, { width: progressWidth }]}
        />
      </View>
    </View>
  );
};

type DidYouKnowCarouselProps = {
  images: Array<{ type: string; url?: string; localPathId?: string }>;
  theme: Theme;
};

const DidYouKnowCarousel = ({ images, theme }: DidYouKnowCarouselProps) => {
  const { width } = useWindowDimensions();
  const styles = createStyles(theme);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carouselContent}
    >
      {images.map((image, index) => {
        if (image.type === "image" && "url" in image && image.url) {
          return (
            <Image
              key={index}
              source={{ uri: image.url }}
              style={styles.carouselImage}
              resizeMode="cover"
            />
          );
        }
        // Placeholder for local images or other types
        return (
          <View key={index} style={styles.carouselPlaceholder}>
            <Text style={styles.placeholderText}>Image {index + 1}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingTop: 20,
    },
    container: {
      flex: 1,
      paddingHorizontal: 24,
      gap: 40,
    },
    title: {
      fontFamily: theme.typography.fontFamily.title,
      fontSize: theme.typography.fontSize["2xl"],
      fontWeight: theme.typography.fontWeight.semibold,
      lineHeight:
        theme.typography.fontSize["2xl"] * theme.typography.lineHeight.tight,
      color: theme.colors.text.primary,
      textAlign: "center",
      letterSpacing: -0.76,
    },
    stepsContainer: {
      gap: 24,
    },
    stepContainer: {
      gap: 8,
    },
    stepHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stepLabel: {
      fontFamily: theme.typography.fontFamily.text,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.regular,
      letterSpacing: -0.32,
      lineHeight:
        theme.typography.fontSize.md * theme.typography.lineHeight.normal,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    checkmarkPlaceholder: {
      width: 24,
      height: 24,
      backgroundColor: "transparent",
    },
    checkmarkText: {
      fontSize: 16,
      color: theme.colors.text.opposite,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    progressBar: {
      height: 12,
      backgroundColor: theme.colors.neutral.lowest,
      borderRadius: 200,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: 200,
    },
    carouselSection: {
      gap: 16,
      marginTop: 20,
    },
    carouselTitle: {
      fontFamily: theme.typography.fontFamily.text,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.disable,
      textAlign: "center",
    },
    carouselContent: {
      gap: 16,
      paddingHorizontal: 8,
    },
    carouselImage: {
      width: 300,
      height: 200,
      borderRadius: 16,
    },
    carouselPlaceholder: {
      width: 300,
      height: 200,
      borderRadius: 16,
      backgroundColor: theme.colors.neutral.lowest,
      justifyContent: "center",
      alignItems: "center",
    },
    placeholderText: {
      fontFamily: theme.typography.fontFamily.text,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text.disable,
    },
    buttonContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    // Circle variant styles
    circleSection: {
      alignItems: "center",
      justifyContent: "center",
    },
    textListSection: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 100,
    },
  });

export const LoaderRenderer = LoaderRendererBase;
