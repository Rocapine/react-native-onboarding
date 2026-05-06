import {
  useOnboardingStep,
  resolveNextStepNumber,
  OnboardingProgressContext,
} from "@rocapine/react-native-onboarding";
import { OnboardingPage } from "@rocapine/react-native-onboarding-ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext } from "react";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function QuestionPage() {
  const { questionId } = useLocalSearchParams();
  const { step, steps } = useOnboardingStep({
    stepNumber: parseInt(questionId as string, 10),
  });

  const { setVariable, getVariables } = useContext(OnboardingProgressContext);
  const router = useRouter();

  const onContinue = (value?: any) => {
    const variableName = (step as any).variableName as string | undefined;

    if (variableName && value !== undefined) {
      setVariable(variableName, value);
    }

    const updatedVars =
      variableName && value !== undefined
        ? { ...getVariables(), [variableName]: value }
        : getVariables();

    const nextNumber = resolveNextStepNumber(step, updatedVars, steps);
    if (nextNumber === null) {
      router.push("/");
    } else {
      router.push(`/onboarding/${nextNumber}`);
    }
  };

  return <OnboardingPage step={step} onContinue={onContinue} />;
}
