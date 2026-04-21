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
  const [composableVariables, setComposableVariables] = useState<Record<string, ComposableVariableEntry>>({});

  const setComposableVariable = useCallback((key: string, entry: ComposableVariableEntry | string) => {
    const normalizedEntry: ComposableVariableEntry = typeof entry === "string" ? { value: entry } : entry;
    setComposableVariables((prev) => ({ ...prev, [key]: normalizedEntry }));
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

export type ComposableVariableEntry = { value: string; label?: string };

export const OnboardingProgressContext = createContext({
  activeStep: { number: 0, displayProgressHeader: false },
  setActiveStep: (_step: {
    number: number;
    displayProgressHeader: boolean;
  }) => { },
  totalSteps: 0,
  setTotalSteps: (_steps: number) => { },
  composableVariables: {} as Record<string, ComposableVariableEntry>,
  setComposableVariable: (_key: string, _entry: ComposableVariableEntry | string) => { },
});
