import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  useOnboardingNavigation,
  useOnboardingHeaderHeight,
  useProgressHeaderConfig,
} from "@rocapine/react-native-onboarding";
import { defaultTheme, Theme } from "../Theme";

interface ProgressBarProps {
  backgroundColor?: string;
  progressColor?: string;
  progressPercentage: number;
  theme?: Theme;
  isProgressBarVisible?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  backgroundColor,
  progressColor,
  progressPercentage = 0,
  theme = defaultTheme,
  isProgressBarVisible = true,
}) => {
  const animated = true;
  const { useRouter } = useOnboardingNavigation();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { setHeaderHeight } = useOnboardingHeaderHeight();
  // Studio-authored styling (`configuration.progressHeader`). Empty object when
  // unauthored, so every field below falls back on its own.
  const config = useProgressHeaderConfig();

  // Publish the bar's real measured footprint so step content can offset below
  // it instead of guessing. Reset to 0 when hidden (the View unmounts, so
  // onLayout never fires a 0 on its own).
  useEffect(() => {
    if (!isProgressBarVisible) setHeaderHeight(0);
  }, [isProgressBarVisible, setHeaderHeight]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    setHeaderHeight(e.nativeEvent.layout.height);
  };

  // Resolution order: explicit prop > studio configuration > theme > default.
  // The studio block deliberately outranks the theme because a theme-only knob
  // could not reach the screen at all: `ThemeProvider` is fed solely by the host's
  // `customTheme`/`customLightTheme`/`customDarkTheme` props, and NOTHING in the
  // SDK reads `configuration.theme` — the edge function delivers it and no
  // consumer exists. So the host theme is the only theme at runtime. This block is
  // the one path by which Studio can actually restyle the bar.
  const height = config.height ?? 12;
  // Half the height keeps the track a pill at ANY thickness. This renders
  // identically to the previous hardcoded 10: RN clamps a radius to half the
  // smaller dimension, so 10 on a 12px-tall bar was already drawing as 6.
  // Deriving it means a taller configured bar stays rounded instead of turning
  // into a slab with slightly soft corners.
  const borderRadius = config.borderRadius ?? height / 2;
  const paddingHorizontal = config.paddingHorizontal ?? 16;
  const paddingBottom = config.paddingBottom ?? 24;
  const gap = config.gap ?? 16;
  const trackFlex = config.trackFlex ?? 5;
  const backButtonSize = config.backButtonSize ?? 24;
  const showBackButton = !config.hideBackButton && router.canGoBack();
  // Use Reanimated shared value for smooth animations
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      progress.value = withTiming(progressPercentage, {
        duration: 300,
      });
    } else {
      progress.value = progressPercentage;
    }
  }, [progressPercentage, animated]);

  // Animated style for the progress bar
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
    };
  });

  const trackBgColor = backgroundColor ?? config.backgroundColor ?? theme.colors.neutral.lower;
  const barColor = progressColor ?? config.progressColor ?? theme.colors.primary;
  const backButtonColor = config.backButtonColor ?? theme.colors.text.primary;

  return (
    isProgressBarVisible && (
      <View
        style={[styles.container, { paddingTop: top, paddingBottom }]}
        onLayout={onContainerLayout}
      >
        <View style={[styles.progressBarContainer, { gap, paddingHorizontal }]}>
          {/* Left section: Back button */}
          <View style={styles.backButtonSection}>
            {showBackButton && (
              <TouchableOpacity
                onPress={() => router.goBack()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.backButton}
              >
                <ChevronLeft
                  size={backButtonSize}
                  color={backButtonColor}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Center section: Progress bar */}
          <View style={[styles.progressSection, { flex: trackFlex }]}>
            <View
              style={[styles.track, { height, borderRadius, backgroundColor: trackBgColor }]}
            >
              <Animated.View
                style={[
                  styles.progress,
                  {
                    height,
                    borderRadius,
                    backgroundColor: barColor,
                  },
                  animatedStyle,
                ]}
              />
            </View>
          </View>

          {/* Right section: Spacer */}
          <View style={styles.spacerSection} />
        </View>
      </View>
    )
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: "center",
    // `paddingBottom` is applied inline from the resolved config (defaults to 24).
  },
  progressBarContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    // `gap` / `paddingHorizontal` are applied inline from the resolved config
    // (they default to 16 / 16, the previous hardcoded values).
  },
  backButtonSection: {
    flex: 1,
    alignItems: "flex-start",
  },
  backButton: {
    padding: 4,
  },
  progressSection: {
    // `flex` is applied inline from the resolved config (defaults to 5).
    alignItems: "flex-end",
  },
  spacerSection: {
    flex: 1,
  },
  track: {
    width: "100%",
    // `borderRadius` is applied inline from the resolved config (defaults to
    // half the height, which is 10 at the default height of 12 — as before).
    overflow: "hidden",
  },
  progress: {},
});
