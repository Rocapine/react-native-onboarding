import {
  OnboardingProvider,
  OnboardingStudioClient,
  onboardingExample,
} from "@rocapine/react-native-onboarding";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ThemeProvider } from "@rocapine/react-native-onboarding-ui";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

const client = new OnboardingStudioClient(
  "7d7c34cd-8dc7-4bc5-8672-a5b24ab9be07",
  {
    appVersion: "1.0.0",
    isSandbox: true,
    fallbackOnboarding: onboardingExample,
    timeout: 10000,
    baseUrl: "http://127.0.0.1:64321/functions/v1",
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
    <OnboardingProvider
      client={client}
      locale="en"
      customAudienceParams={{
      }}
    >
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </OnboardingProvider>
  );
}
