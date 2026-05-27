import {
  OnboardingProvider,
  OnboardingStudioClient,
  onboardingExample,
} from "@rocapine/react-native-onboarding";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { OnboardingProgressProvider } from "@rocapine/react-native-onboarding-ui";
import { Dimensions } from "react-native";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { LocaleProvider, useLocale } from "../contexts/locale-context";

configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

const client = new OnboardingStudioClient(
  process.env.EXPO_PUBLIC_ONBOARDING_PROJECT_ID!,
  {
    appVersion: "1.0.0",
    isSandbox: true,
    fallbackOnboarding: onboardingExample,
    timeout: 10000,
    baseUrl: process.env.EXPO_PUBLIC_ONBOARDING_BASE_URL,
  }
);

export default function RootLayout() {
  // Load custom fonts - Futura Bold for demonstration
  const [fontsLoaded, fontError] = useFonts({
    "Futura-Bold": require("../assets/fonts/FuturaBold.otf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <LocaleProvider>
      <OnboardingProviderWithLocale />
    </LocaleProvider>
  );
}

function OnboardingProviderWithLocale() {
  const { locale } = useLocale();
  return (
    <OnboardingProvider
      client={client}
      locale={locale}
      customAudienceParams={{
      }}
      customActions={{
        trackCta: async ({ variables }) => {
          console.log("[customAction] trackCta fired with variables:", variables);
        },
        celebrate: async ({ variables }) => {
          console.log("[customAction] celebrate", variables);
        },
      }}
    >
      <OnboardingProgressProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingProgressProvider>
    </OnboardingProvider>
  );
}
