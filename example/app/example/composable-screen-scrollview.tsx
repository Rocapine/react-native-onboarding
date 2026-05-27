import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

const card = (id: string, label: string) => ({
  id,
  type: 'Text' as const,
  props: {
    content: label,
    width: 160,
    height: 100,
    marginHorizontal: 6,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#00000020',
    paddingVertical: 38,
    textAlign: 'center' as const,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});

const listRow = (id: string, label: string) => ({
  id,
  type: 'Text' as const,
  props: {
    content: label,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
    fontSize: 15,
  },
});

export default function ComposableScreenScrollViewExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-scrollview',
    type: 'ComposableScreen',
    name: 'ComposableScreen — ScrollView',
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
              props: { content: 'ScrollView', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'horizontal-label',
              type: 'Text',
              props: { content: 'Horizontal — swipeable cards', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'horizontal-scroll',
              type: 'ScrollView' as const,
              props: {
                horizontal: true,
                showsHorizontalScrollIndicator: false,
                contentContainerPadding: 4,
              },
              children: [
                card('h-card-1', 'Card 1'),
                card('h-card-2', 'Card 2'),
                card('h-card-3', 'Card 3'),
                card('h-card-4', 'Card 4'),
                card('h-card-5', 'Card 5'),
              ],
            },
            {
              id: 'vertical-label',
              type: 'Text',
              props: { content: 'Vertical — fixed height, inner scroll', fontSize: 13, fontWeight: '600', opacity: 0.5 },
            },
            {
              id: 'vertical-scroll',
              type: 'ScrollView' as const,
              props: {
                height: 180,
                bounces: true,
                showsVerticalScrollIndicator: true,
                borderWidth: 1,
                borderRadius: 12,
                borderColor: '#00000020',
                overflow: 'hidden',
                contentContainerPadding: 12,
              },
              children: [
                {
                  id: 'v-stack',
                  type: 'YStack' as const,
                  props: { gap: 8 },
                  children: [
                    listRow('v-row-1', 'Option 1'),
                    listRow('v-row-2', 'Option 2'),
                    listRow('v-row-3', 'Option 3'),
                    listRow('v-row-4', 'Option 4'),
                    listRow('v-row-5', 'Option 5'),
                    listRow('v-row-6', 'Option 6'),
                    listRow('v-row-7', 'Option 7'),
                    listRow('v-row-8', 'Option 8'),
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
