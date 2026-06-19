import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CarouselStepType,
  CarouselStepTypeSchema,
  CarouselScreenType,
} from "./types";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRef, useState } from "react";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";

type ContentProps = {
  step: CarouselStepType;
  onContinue: () => void;
  theme?: Theme;
};

const CarouselRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const validatedData = CarouselStepTypeSchema.parse(step);
  const { screens, pagination } = validatedData.payload;
  const { width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Resolve pagination config — `pagination` is optional, so fall back to the
  // original hardcoded look when absent (keeps existing onboardings unchanged).
  const dots = {
    show: pagination?.show ?? true,
    dotColor: pagination?.dotColor ?? theme.colors.neutral.lower,
    activeDotColor: pagination?.activeDotColor ?? theme.colors.primary,
    dotWidth: pagination?.dotWidth ?? 8,
    dotHeight: pagination?.dotHeight ?? 8,
    activeDotWidth: pagination?.activeDotWidth ?? 24,
    activeDotHeight: pagination?.activeDotHeight ?? 8,
    gap: pagination?.gap ?? 8,
    position: pagination?.position ?? "bottom",
    marginTop: pagination?.marginTop ?? 20,
    marginBottom: pagination?.marginBottom ?? 20,
  };

  const indicators = dots.show ? (
    <View
      style={[
        styles.indicatorContainer,
        { gap: dots.gap, marginTop: dots.marginTop, marginBottom: dots.marginBottom },
      ]}
    >
      {screens.map((_, index) => {
        const isActive = index === currentPage;
        const dotW = isActive ? dots.activeDotWidth : dots.dotWidth;
        const dotH = isActive ? dots.activeDotHeight : dots.dotHeight;
        return (
          <View
            key={index}
            style={{
              width: dotW,
              height: dotH,
              borderRadius: dotH / 2,
              backgroundColor: isActive ? dots.activeDotColor : dots.dotColor,
            }}
          />
        );
      })}
    </View>
  ) : null;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newPage = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const handleButtonPress = () => {
    const isLastPage = currentPage === screens.length - 1;

    if (isLastPage) {
      onContinue();
      return;
    }

    const nextPage = currentPage + 1;
    scrollViewRef.current?.scrollTo({
      x: nextPage * width,
      animated: true,
    });
    setCurrentPage(nextPage);
  };

  const isLastPage = currentPage === screens.length - 1;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
    <OnboardingTemplate
      step={step}
      onContinue={handleButtonPress}
      theme={theme}
      button={{
        text: isLastPage
          ? (validatedData.buttonSection?.label?.trim() || validatedData.continueButtonLabel)
          : "Next",
        icon: isLastPage ? (validatedData.buttonSection?.icon?.trim() || null) : null,
      }}
    >
      <View style={styles.container}>
        {dots.position === "top" && indicators}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScroll}
          style={styles.scrollView}
        >
          {screens.map((screen, index) => (
            <CarouselScreen key={index} width={width} screen={screen} theme={theme} />
          ))}
        </ScrollView>

        {/* Page Indicators */}
        {dots.position === "bottom" && indicators}
      </View>
    </OnboardingTemplate>
    </SafeAreaView>
  );
};

type CarouselScreenProps = {
  width: number;
  screen: CarouselScreenType;
  theme: Theme;
};

const CarouselScreen = ({ width, screen, theme }: CarouselScreenProps) => {
  const renderMedia = () => {
    const { mediaUrl } = screen;

    if (mediaUrl.includes(".riv")) {
      return (
        <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Rive Animation</Text>
        </View>
      );
    } else if (mediaUrl.includes(".json")) {
      return <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.neutral.lowest }]}>
        <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.disable }]}>Lottie Animation</Text>
      </View>
    } else {
      return (
        <Image
          source={{ uri: mediaUrl }}
          style={styles.mediaImage}
          resizeMode="contain"
        />
      );
    }
  };

  return (
    <View style={[styles.screenContainer, { width }]}>
      {/* Media */}
      <View style={styles.mediaContainer}>{renderMedia()}</View>

      {/* Text Content */}
      <View style={styles.textContainer}>
        <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{screen.title}</Text>
        {screen.subtitle && (
          <Text style={[getTextStyle(theme, "heading3"), styles.subtitle, { color: theme.colors.text.secondary }]}>{screen.subtitle}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 32,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 300,
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {},
  textContainer: {
    gap: 16,
    paddingBottom: 24,
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.76,
  },
  subtitle: {
    textAlign: "center",
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});

import { withErrorBoundary } from '../../ErrorBoundary';

export const CarouselRenderer = withErrorBoundary(CarouselRendererBase, 'Carousel');
