import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenCheckboxGridExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-checkbox-grid',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Checkbox Grid',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 20, padding: 24 },
          children: [
            {
              id: 'title',
              type: 'Text' as const,
              props: {
                content: "What's working for you right now?",
                fontSize: 24,
                fontWeight: '700' as const,
                textAlign: 'center' as const,
              },
            },
            {
              id: 'subtitle',
              type: 'Text' as const,
              props: {
                content: 'Choose up to 3',
                fontSize: 14,
                textAlign: 'center' as const,
                opacity: 0.5,
              },
            },
            {
              id: 'tiles',
              type: 'CheckboxGroup' as const,
              props: {
                variableName: 'weekHighlight',
                // New feature: image-tile grid + selection cap
                columns: 2,
                gap: 16,
                itemAlign: 'column' as const,
                itemBorderRadius: 16,
                itemPadding: 8,
                showTick: true,
                maxSelection: 3,
                disableAtMax: true,
                items: [
                  {
                    label: 'I have a steady energy',
                    value: 'steady-energy',
                    imageUrl: 'https://picsum.photos/seed/steady-energy/400/300',
                    imageAspectRatio: 1.3,
                  },
                  {
                    label: 'My mood is stable',
                    value: 'stable-mood',
                    imageUrl: 'https://picsum.photos/seed/stable-mood/400/300',
                    imageAspectRatio: 1.3,
                  },
                  {
                    label: 'No cravings',
                    value: 'no-cravings',
                    imageUrl: 'https://picsum.photos/seed/no-cravings/400/300',
                    imageAspectRatio: 1.3,
                  },
                  {
                    label: 'I sleep well',
                    value: 'sleep-well',
                    imageUrl: 'https://picsum.photos/seed/sleep-well/400/300',
                    imageAspectRatio: 1.3,
                  },
                  { label: 'Other', value: 'other' },
                ],
              },
            },
            {
              id: 'selection-display',
              type: 'Text' as const,
              props: {
                content: 'Selected: {{weekHighlight}}',
                mode: 'expression' as const,
                fontSize: 13,
                textAlign: 'center' as const,
                opacity: 0.6,
              },
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
