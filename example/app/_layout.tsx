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
import { shouldGeneratePlanFail } from "../components/asyncGateDemo";
import { REFS as PRODUCT_REFS, provider as productProvider } from "./example/composable-screen-products";

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

// Attempt counter for the `generatePlan` demo handler below.
let generatePlanAttempts = 0;

function OnboardingProviderWithLocale() {
  const { locale } = useLocale();
  const router = useRouter();
  return (
    <OnboardingProvider
      client={client}
      locale={locale}
      productProvider={productProvider}
      productRefs={PRODUCT_REFS}
      customAudienceParams={{
      }}
      customActions={{
        trackCta: async ({ variables }) => {
          console.log("[customAction] trackCta fired with variables:", variables);
        },
        celebrate: async ({ variables }) => {
          console.log("[customAction] celebrate", variables);
        },
        // RNO#191 demo. Slow on purpose (the pending state needs something to
        // show), and its failure schedule lives in `shouldGeneratePlanFail` so
        // the arithmetic can be pinned against the payload's `retry.maxAttempts`
        // — round 1 threw on every ODD attempt with a cap of 3, which made every
        // press fail-then-succeed and left the `onError` branch of the demo
        // unreachable (review round 2, finding 3). Now a press spends its whole
        // retry budget and lands in `onError`, and the next one resolves.
        generatePlan: async ({ variables, setVariable }) => {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          generatePlanAttempts += 1;
          if (shouldGeneratePlanFail(generatePlanAttempts)) {
            throw new Error("[customAction] generatePlan: simulated backend failure");
          }
          const goal = variables.goal?.label ?? variables.goal?.value ?? "you";
          setVariable("plan", { value: `12-week plan for ${goal}`, kind: "string" });
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
