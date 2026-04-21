import { createContext, useState, useCallback } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../Theme/ThemeProvider";
import { ColorScheme } from "../Theme/types";

export const OnboardingProgressProvider = ({
  children,
  initialColorScheme = "light",
}: {
  children: React.ReactNode;
  initialColorScheme?: ColorScheme;
}) => {
  const [activeStep, setActiveStep] = useState({
    number: 0,
    displayProgressHeader: false,
  });
  const [totalSteps, setTotalSteps] = useState(0);
  const [composableVariables, setComposableVariables] = useState<Record<string, string>>({});

  const setComposableVariable = useCallback((key: string, value: string) => {
    setComposableVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider initialColorScheme={initialColorScheme}>
        <OnboardingProgressContext.Provider
          value={{ activeStep, setActiveStep, totalSteps, setTotalSteps, composableVariables, setComposableVariable }}
        >
          {children}
        </OnboardingProgressContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export const OnboardingProgressContext = createContext({
  activeStep: { number: 0, displayProgressHeader: false },
  setActiveStep: (_step: {
    number: number;
    displayProgressHeader: boolean;
  }) => { },
  totalSteps: 0,
  setTotalSteps: (_steps: number) => { },
  composableVariables: {} as Record<string, string>,
  setComposableVariable: (_key: string, _value: string) => { },
});
