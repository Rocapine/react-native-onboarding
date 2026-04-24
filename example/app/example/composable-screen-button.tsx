import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenButtonExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-button',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Button',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 16, padding: 24 },
          children: [
            {
              id: 'section-title',
              type: 'Text',
              props: { content: 'Button', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'filled-label',
              type: 'Text',
              props: { content: 'filled', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'btn-filled',
              type: 'Button' as const,
              props: { label: 'Get Started', variant: 'filled' as const },
            },
            {
              id: 'outlined-label',
              type: 'Text',
              props: { content: 'outlined', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'btn-outlined',
              type: 'Button' as const,
              props: { label: 'Learn More', variant: 'outlined' as const },
            },
            {
              id: 'filled-wide-label',
              type: 'Text',
              props: { content: 'filled — full width', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'btn-filled-wide',
              type: 'Button' as const,
              props: { label: 'Continue', variant: 'filled' as const, alignSelf: 'stretch' as const },
            },
          ],
        },
      ],
    },
    customPayload: null,
    continueButtonLabel: 'Continue',
    figmaUrl: null,
  } satisfies OnboardingUi.ComposableScreenStepType;

  return (
    <View style={{ flex: 1 }}>
      <OnboardingUi.ComposableScreenRenderer step={step} onContinue={() => router.back()} />
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 32,
  },
});
