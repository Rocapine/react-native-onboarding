import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { OnboardingStepType } from "./types";
import { RatingsRenderer, PickerRenderer, CommitmentRenderer, CarouselRenderer, LoaderRenderer, MediaContentRenderer, QuestionRenderer } from "./Pages";
import { View, Text, Button } from 'react-native';
import { useTheme } from "./Theme/useTheme";


interface OnboardingPageProps {
  step: OnboardingStepType;
  onContinue: (args?: any) => void;
  client?: OnboardingStudioClient;
}

export const OnboardingPage = ({ step, onContinue, client }: OnboardingPageProps) => {
  const { theme } = useTheme();

  switch (step.type) {
    case 'Ratings':
      return <RatingsRenderer step={step} onContinue={onContinue} theme={theme} />;
    case 'Picker':
      return <PickerRenderer step={step} onContinue={onContinue} theme={theme} />;
    case 'Commitment':
      return <CommitmentRenderer step={step} onContinue={onContinue} theme={theme} />;
    case 'Carousel':
      return <CarouselRenderer step={step} onContinue={onContinue} theme={theme} />;
    case 'MediaContent':
      return <MediaContentRenderer step={step} onContinue={onContinue} theme={theme} />;
    case 'Loader':
      return <LoaderRenderer step={step} onContinue={onContinue} theme={theme} />;
    case 'Question':
      return <QuestionRenderer step={step} onContinue={onContinue} theme={theme} />;
    default:
      if (client?.options?.isSanbdox) {
        // @ts-ignore
        const stepType = step.type;
        return <View>
          <Text>Screen {stepType} not implemented</Text>
          <Button title="Continue" onPress={onContinue} />
        </View>
      } else {
        onContinue("onboarding_screen_not_implemented");
        return <View>
          <Text>You are almost done</Text>
          <Button title="Continue" onPress={onContinue} />
        </View>
      }
  }
};