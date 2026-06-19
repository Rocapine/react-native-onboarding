import * as OnboardingUI from "@rocapine/react-native-onboarding-ui";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function CarouselExample() {
  const router = useRouter();

  const stepPayload = {
    screens: [
      {
        // mediaSource: {
        //   type: 'image' as const,
        //   mediaUrl: 'https://picsum.photos/400/600',
        // },
        mediaUrl: "https://picsum.photos/400/600",
        title: "Welcome to Our App",
        subtitle: "Discover amazing features",
      },
      {
        // mediaSource: {
        //   type: "image" as const,
        //   url: "https://picsum.photos/400/601",
        // },
        mediaUrl: "https://picsum.photos/400/601",
        title: "Track Your Progress",
        subtitle: "See your improvements over time",
      },
      {
        // mediaSource: {
        //   type: "image" as const,
        //   url: "https://picsum.photos/400/602",
        // },
        title: "Achieve Your Goals",
        mediaUrl: "https://picsum.photos/400/602",
        subtitle: "Stay motivated and reach new heights",
      },
    ],
    pagination: {
      activeDotColor: "#E76F51",
      dotColor: "#E9C46A",
      dotWidth: 10,
      dotHeight: 10,
      activeDotWidth: 32,
      activeDotHeight: 10,
      gap: 12,
      position: "bottom",
      marginTop: 16,
      marginBottom: 24,
    },
  } satisfies OnboardingUI.CarouselStepType["payload"];

  const step = {
    id: "carousel-1",
    type: "Carousel",
    name: "Carousel",
    displayProgressHeader: true,
    payload: stepPayload,
    customPayload: null,
    continueButtonLabel: "Continue",
    figmaUrl: null,
  } satisfies OnboardingUI.CarouselStepType;

  const handleContinue = () => {
    console.log("Carousel completed!");
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <OnboardingUI.CarouselRenderer
        step={step}
        onContinue={handleContinue}
      />
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 32,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 32,
    fontWeight: "400",
    lineHeight: 32,
  },
});
