import * as OnboardingUi from "@rocapine/react-native-onboarding-ui";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { defaultTheme } from "@rocapine/react-native-onboarding-ui";

export const unstable_settings = {
  anchor: "(tabs)",
};

const stepPayload = {
  title: "What are your fitness goals?",
  subtitle: "Select all that apply",
  multipleAnswer: true,
  answers: [
    {
      label: "Lose weight",
      value: "lose_weight",
      icon: null,
      description: null,
    },
    {
      label: "Build muscle",
      value: "build_muscle",
      icon: null,
      description: null,
    },
    {
      label: "Improve endurance",
      value: "improve_endurance",
      icon: null,
      description: null,
    },
    {
      label: "Stay active",
      value: "stay_active",
      icon: null,
      description: null,
    },
    {
      label: "None of the above",
      value: "None of the above",
      icon: null,
      description: null,
    },
  ],
  infoBox: null,
} satisfies OnboardingUi.QuestionStepType["payload"];

export const step = {
  id: "question-1",
  type: "Question",
  name: "Question",
  displayProgressHeader: true,
  payload: stepPayload,
  customPayload: null,
  continueButtonLabel: "Continue",
  figmaUrl: null,
} satisfies OnboardingUi.QuestionStepType;


export default function QuestionExample() {
  const router = useRouter();


  return (
    <View style={{ flex: 1, backgroundColor: "blue" }}>
      <OnboardingUi.QuestionRenderer
        step={step}
        onContinue={(answers) => console.log("Selected:", answers)}
        theme={defaultTheme}
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
