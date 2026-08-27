import { OnboardingStepType } from "./types";
import type { ScreenHost } from "./Runtime/ScreenHost";
import { RatingsRenderer, PickerRenderer, CommitmentRenderer, CarouselRenderer, LoaderRenderer, MediaContentRenderer, ComposableScreenRenderer, PaywallStepRenderer, QuestionRenderer, QuestionAnswerButtonProps, QuestionAnswersListProps } from "./Pages";
import { View, Text, Button } from 'react-native';
import { useTheme } from "./Theme/useTheme";
import { Theme } from "./Theme";


export interface OnboardingPageProps {
  step: OnboardingStepType;
  onContinue: (args?: any) => void;
  isSandbox?: boolean;
  theme?: Theme;
  /** Offset for ComposableScreen keyboard avoidance — pass the height of any fixed header rendered above the page. */
  keyboardVerticalOffset?: number;
  /**
   * Overrides how long a deferred `animation.entering.once` entrance waits after
   * mount before playing, in ms (default 350). Set it to match this app's
   * navigator push duration — the SDK cannot detect that, and the host is the
   * only party that knows it.
   *
   * Threaded from here because `OnboardingPage` builds the `ScreenHost` itself:
   * putting the field only on `ScreenHost` left it unreachable for every
   * consumer entering through this component, which is the documented path.
   */
  enteringSettleDelayMs?: number;
  customComponents?: {
    QuestionAnswerButton?: React.ComponentType<QuestionAnswerButtonProps>;
    QuestionAnswersList?: React.ComponentType<QuestionAnswersListProps>;
  };
}

export const OnboardingPage = ({ step, onContinue, isSandbox, keyboardVerticalOffset, enteringSettleDelayMs }: OnboardingPageProps) => {
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
    case 'ComposableScreen':
      return <ComposableScreenRenderer step={step} onContinue={onContinue} keyboardVerticalOffset={keyboardVerticalOffset} enteringSettleDelayMs={enteringSettleDelayMs} />;
    // A step that IS a paywall. `payload.moment` names a moment; the audience
    // waterfall behind it picks which paywall renders. Hard-gated: only a
    // purchase advances. Requires an ancestor PaywallProvider.
    case 'Paywall':
      return <PaywallStepRenderer step={step} onContinue={onContinue} keyboardVerticalOffset={keyboardVerticalOffset} />;
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

// ---------------------------------------------------------------------------
// Compile-time reachability gate.
//
// Twice now a `ScreenHost` field has shipped correct, type-safe, tested — and
// unreachable, because `OnboardingPage` BUILDS the host, so a consumer entering
// through it can never set the field. `enteringSettleDelayMs` did exactly this
// in 1.65.0: present on `ScreenHost`, absent from this component's props, so the
// documented "raise the delay" escape hatch could not be taken.
//
// Nothing caught it. The tests exercise `ScreenRenderer` with a hand-built host
// — the one caller for whom every field is trivially reachable — so the consumer
// path was never the thing under test.
//
// This asserts the inverse and costs nothing at runtime (pure types, no emit):
// every `ScreenHost` field NOT listed as internally-provided must be settable
// from here. Adding a new host field therefore fails the build until it is
// either threaded through this component or deliberately declared internal.
// ---------------------------------------------------------------------------

/** Host fields the SDK constructs itself; a consumer never supplies them. */
type HostProvidedInternally =
  | "variables"
  | "setVariable"
  | "complete"
  | "customActions"
  | "products"
  | "presentPaywall";

/** Everything else on `ScreenHost` is the consumer's to set. */
type ConsumerSettableHostField = Exclude<keyof ScreenHost, HostProvidedInternally>;

type AssertTrue<T extends true> = T;

// If this line errors, a consumer-settable `ScreenHost` field is not reachable
// from `OnboardingPage`. Thread it through (follow `keyboardVerticalOffset`), or
// add it to `HostProvidedInternally` if the SDK really does own it.
export type _ConsumerHostFieldsAreReachable = AssertTrue<
  ConsumerSettableHostField extends keyof OnboardingPageProps ? true : false
>;
