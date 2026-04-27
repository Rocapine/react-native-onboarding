import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenFormExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-form',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Form',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 24, padding: 24 },
          children: [
            {
              id: 'section-title',
              type: 'Text',
              props: { content: 'Form Elements', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'input-label',
              type: 'Text',
              props: { content: 'Input', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
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
            {
              id: 'radio-label',
              type: 'Text',
              props: { content: 'RadioGroup', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'hero-radio',
              type: 'RadioGroup' as const,
              props: {
                variableName: 'plan',
                defaultValue: 'monthly',
                gap: 8,
                items: [
                  { label: 'Monthly', value: 'monthly' },
                  { label: 'Yearly', value: 'yearly' },
                  { label: 'Lifetime', value: 'lifetime' },
                ],
              },
            },
            {
              id: 'plan-display',
              type: 'Text' as const,
              props: {
                content: 'Selected: {{plan}}',
                mode: 'expression' as const,
                fontSize: 13,
                textAlign: 'center' as const,
                opacity: 0.6,
              },
            },
            {
              id: 'checkbox-label',
              type: 'Text',
              props: { content: 'CheckboxGroup', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'hero-checkbox',
              type: 'CheckboxGroup' as const,
              props: {
                variableName: 'goals',
                defaultValues: ['health', 'fitness'],
                gap: 8,
                items: [
                  { label: 'Improve health', value: 'health' },
                  { label: 'Build fitness', value: 'fitness' },
                  { label: 'Lose weight', value: 'weight' },
                  { label: 'Gain muscle', value: 'muscle' },
                ],
              },
            },
            {
              id: 'goals-display',
              type: 'Text' as const,
              props: {
                content: 'Goals: {{goals}}',
                mode: 'expression' as const,
                fontSize: 13,
                textAlign: 'center' as const,
                opacity: 0.6,
              },
            },
            {
              id: 'datepicker-label',
              type: 'Text',
              props: { content: 'DatePicker', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'hero-date-picker',
              type: 'DatePicker' as const,
              props: {
                variableName: 'birthdate',
                defaultValue: '1990-01-01T00:00:00.000Z',
                mode: 'date' as const,
                display: 'spinner' as const,
                maximumDate: new Date().toISOString(),
              },
            },
            {
              id: 'birthdate-display',
              type: 'Text' as const,
              props: {
                content: 'Birth date: {{birthdate}}',
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
