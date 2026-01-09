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
  "438d5493-1b72-4e12-9523-d9835ee98a52",
  {
    appVersion: "1.0.0",
    isSandbox: true,
    fallbackOnboarding: onboardingExample,
    timeout: 10000,
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
        myconfig: "myconfig",
        onboardingId: "6e5c6818-b9a1-44e8-a5c3-a27f7cfccbb3",
      }}
    >
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </OnboardingProvider>
  );
}
