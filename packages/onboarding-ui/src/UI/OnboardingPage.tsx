import { OnboardingStepType } from "./types";
import { RatingsRenderer, PickerRenderer, CommitmentRenderer, CarouselRenderer, LoaderRenderer, MediaContentRenderer, NewCustomScreenRenderer, QuestionRenderer, QuestionAnswerButtonProps, QuestionAnswersListProps } from "./Pages";
import { View, Text, Button } from 'react-native';
import { useTheme } from "./Theme/useTheme";
import { Theme } from "./Theme";


interface OnboardingPageProps {
  step: OnboardingStepType;
  onContinue: (args?: any) => void;
  isSandbox?: boolean;
  theme?: Theme;
  customComponents?: {
    QuestionAnswerButton?: React.ComponentType<QuestionAnswerButtonProps>;
    QuestionAnswersList?: React.ComponentType<QuestionAnswersListProps>;
  };
}

export const OnboardingPage = ({ step, onContinue, isSandbox }: OnboardingPageProps) => {
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
    case 'NewCustomScreen':
      return <NewCustomScreenRenderer step={step} onContinue={onContinue} theme={theme} />;
    default:
      if (isSandbox) {
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