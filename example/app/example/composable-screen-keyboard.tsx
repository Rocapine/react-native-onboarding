import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

const filler = (id: string, label: string) => ({
  id,
  type: 'Text' as const,
  props: {
    content: label,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
    fontSize: 15,
  },
});

export default function ComposableScreenKeyboardExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-keyboard',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Keyboard',
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
              props: { content: 'KeyboardAvoidingView', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'intro',
              type: 'Text',
              props: {
                content:
                  'Focus the input below. It stays visible above the keyboard instead of being covered.',
                fontSize: 14,
                textAlign: 'center',
                opacity: 0.6,
                lineHeight: 20,
              },
            },
            // Tall filler content pushes the input toward the bottom of the screen.
            filler('filler-1', 'Some content above the input'),
            filler('filler-2', 'More content'),
            filler('filler-3', 'Even more content'),
            filler('filler-4', 'The input sits near the bottom'),
            {
              id: 'kav',
              type: 'KeyboardAvoidingView' as const,
              props: { keyboardVerticalOffset: 24 },
              children: [
                {
                  id: 'input-stack',
                  type: 'YStack' as const,
                  props: { gap: 8 },
                  children: [
                    {
                      id: 'hero-input',
                      type: 'Input' as const,
                      props: {
                        variableName: 'name',
                        placeholder: 'Enter your name',
                        keyboardType: 'default' as const,
                        returnKeyType: 'done' as const,
                        autoCapitalize: 'words' as const,
                        borderRadius: 12,
                      },
                    },
                    {
                      id: 'greeting',
                      type: 'Text' as const,
                      props: {
                        content: 'Hello {{name}}!',
                        mode: 'expression' as const,
                        fontSize: 15,
                        fontWeight: '600',
                        textAlign: 'center' as const,
                        opacity: 0.7,
                      },
                    },
                  ],
                },
              ],
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
