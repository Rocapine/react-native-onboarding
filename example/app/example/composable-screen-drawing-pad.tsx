import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenDrawingPadExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-drawing-pad',
    type: 'ComposableScreen',
    name: 'ComposableScreen — DrawingPad',
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
              props: { content: 'Sign here', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'section-help',
              type: 'Text',
              props: {
                content: 'Draw with your finger. Each stroke is saved to a variable as an SVG path + a base64 PNG.',
                fontSize: 13,
                textAlign: 'center',
                opacity: 0.6,
              },
            },
            {
              id: 'signature-pad',
              type: 'DrawingPad' as const,
              props: {
                variableName: 'signature',
                imageVariableName: 'signatureImage',
                strokeWidth: 3,
                height: 220,
                borderRadius: 16,
                clearable: true,
                // Customized clear button: bottom-right corner, larger, branded.
                clearButtonPosition: 'bottom-right' as const,
                clearButtonOffset: 12,
                clearButtonSize: 40,
                clearButtonColor: '#007AFF',
                clearButtonIconColor: '#ffffff',
                clearButtonLabel: '⟲',
              },
            },
            {
              // Confirmation — appears once the pad has been drawn on (renderWhen
              // on the SVG variable being non-empty).
              id: 'signature-confirm',
              type: 'Text' as const,
              renderWhen: { variable: 'signature', operator: 'is_not_empty' as const },
              props: {
                content: 'Signature captured ✓',
                fontSize: 15,
                fontWeight: '600',
                textAlign: 'center' as const,
                opacity: 0.7,
              },
            },
            {
              // Shows the raw SVG path string written to the variable.
              id: 'signature-svg',
              type: 'Text' as const,
              renderWhen: { variable: 'signature', operator: 'is_not_empty' as const },
              props: {
                content: 'SVG: {{signature}}',
                mode: 'expression' as const,
                fontSize: 11,
                textAlign: 'center' as const,
                opacity: 0.4,
                maxHeight: 80,
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
