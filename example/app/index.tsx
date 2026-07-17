import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useOnboardingStart } from "@rocapine/react-native-onboarding";
import { useTheme } from "@rocapine/react-native-onboarding-ui";
import { SUPPORTED_LOCALES, useLocale } from "../contexts/locale-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const router = useRouter();
  const { theme, colorScheme, toggleTheme } = useTheme();
  // Resolve the entry point from metadata.startStepId (falls back to step 1).
  const { startStepNumber } = useOnboardingStart();
  const { locale, setLocale } = useLocale();

  const handleStartOnboarding = () => {
    router.push(`/onboarding/${startStepNumber}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.neutral.lowest }]}>
      <Pressable style={styles.themeToggle} onPress={toggleTheme}>
        <Text style={styles.themeToggleText}>{colorScheme === "light" ? "🌙" : "☀️"}</Text>
      </Pressable>

      <Text style={[styles.title, { color: theme.colors.text.primary }]}>Welcome to Onboarding</Text>
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>Get started with your journey</Text>

      <View style={styles.localeRow}>
        {SUPPORTED_LOCALES.map((loc) => {
          const active = loc === locale;
          return (
            <Pressable
              key={loc}
              onPress={() => setLocale(loc)}
              style={[
                styles.localeChip,
                {
                  backgroundColor: active ? theme.colors.primary : "transparent",
                  borderColor: active ? theme.colors.primary : theme.colors.neutral.medium,
                },
              ]}
            >
              <Text
                style={[
                  styles.localeChipText,
                  { color: active ? theme.colors.text.opposite : theme.colors.text.primary },
                ]}
              >
                {loc.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={[styles.button, { backgroundColor: theme.colors.primary }]} onPress={handleStartOnboarding}>
        <Text style={[styles.buttonText, { color: theme.colors.text.opposite }]}>Start the onboarding</Text>
      </Pressable>

      <Pressable
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push("/example")}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text.opposite }]}>View Examples</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  themeToggle: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  themeToggleText: {
    fontSize: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  localeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  localeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  localeChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
