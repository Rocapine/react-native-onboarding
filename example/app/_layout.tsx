import {
  OnboardingProvider,
  OnboardingStudioClient,
  onboardingExample,
} from "@rocapine/react-native-onboarding";
import { Stack, useRouter } from "expo-router";
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
  const router = useRouter();
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
        // Writes back into the ComposableScreen variable context. The screen can
        // then react via {{interpolation}} / renderWhen, and a following
        // "continue" can branch on it.
        pickPlan: async ({ variables, setVariable }) => {
          const next = variables.planTier?.value === "pro" ? "free" : "pro";
          setVariable("planTier", {
            value: next,
            label: next === "pro" ? "Pro" : "Free",
            kind: "string",
          });
          console.log("[customAction] pickPlan set planTier =", next);
        },
      }}
      onComplete={({ variables, metadata }) => {
        console.log("[onComplete] onboarding finished", { variables, metadata });
        router.replace("/");
      }}
    >
      <OnboardingProgressProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingProgressProvider>
    </OnboardingProvider>
  );
}
