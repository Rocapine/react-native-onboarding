import React, { useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  runOnJS,
  useAnimatedReaction,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../Theme/useTheme";
import { Theme } from "../Theme/types";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type CircularProgressProps = {
  onProgressComplete?: () => void;
  duration: number;
  totalSteps: number;
};

export const CircularProgress = ({
  onProgressComplete,
  duration,
  totalSteps,
}: CircularProgressProps) => {
  const { theme } = useTheme();
  const { width } = Dimensions.get("window");

  const CIRCLE_RADIUS = 45;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
  const strokeWidth = width * 0.02;

  const progress = useSharedValue(0);
  const [percentage, setPercentage] = useState(0);

  // Update percentage text using useAnimatedReaction. Round *inside* the reader
  // so the JS callback fires only when the displayed integer changes (~100 hops),
  // not every frame — a per-frame setPercentage re-renders this component ~60×/s
  // and the resulting mapper churn destabilizes other animations on the screen.
  // The deps array ([]) is REQUIRED: without it reanimated tears down and rebuilds
  // the mapper on every render, which also resets `prev` and defeats the guard.
  useAnimatedReaction(
    () => Math.round(progress.value),
    (rounded, prev) => {
      if (rounded !== prev) {
        runOnJS(setPercentage)(rounded);
      }
    },
    []
  );

  useEffect(() => {
    // Reset progress
    progress.value = 0;

    // Match StaggeredTextList timing: (totalSteps - 1) * duration + duration * 1.5
    const totalDuration = duration * (totalSteps + 0.5);

    // Animate progress from 0 to 100
    progress.value = withTiming(
      100,
      {
        duration: totalDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      (finished) => {
        if (finished && onProgressComplete) {
          runOnJS(onProgressComplete)();
        }
      }
    );
  }, [progress, duration, totalSteps, onProgressComplete]);

  // Animate strokeDashoffset based on progress
  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value / 100),
  }));

  const styles = createStyles(theme, width);

  return (
    <View style={styles.container}>
      <Svg height="100%" width="100%" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="progressGrad" x1="0" y1="0" x2="0.2" y2="1.1">
            <Stop offset="0" stopColor={theme.colors.neutral.medium} />
            <Stop offset="0.33" stopColor={theme.colors.neutral.medium} />
            <Stop offset="0.67" stopColor={theme.colors.neutral.low} />
            <Stop offset="1" stopColor={theme.colors.neutral.low} />
          </LinearGradient>
        </Defs>

        {/* Background Circle */}
        <Circle
          cx="50"
          cy="50"
          r={CIRCLE_RADIUS}
          stroke={theme.colors.neutral.lower}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress Circle */}
        <AnimatedCircle
          cx="50"
          cy="50"
          r={CIRCLE_RADIUS}
          stroke="url(#progressGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedCircleProps}
          strokeLinecap="round"
          rotation="-90"
          origin="50, 50"
        />
      </Svg>

      {/* Percentage Text */}
      <View style={styles.textContainer}>
        <Text style={styles.percentageText}>{percentage}%</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme, width: number) =>
  StyleSheet.create({
    container: {
      width: width * 0.7,
      height: width * 0.7,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    textContainer: {
      position: "absolute",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      height: "100%",
    },
    percentageText: {
      fontFamily: theme.typography.textStyles.heading1.fontFamily,
      fontSize: theme.typography.textStyles.heading1.fontSize,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      textAlign: "center",
      includeFontPadding: false,
      padding: 0,
    },
  });
