import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenLayoutExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-layout',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Text & Layout',
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
              props: { content: 'Text & Layout', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'heading1',
              type: 'Text',
              props: { content: 'Heading 1', fontSize: 32, fontWeight: '800', textAlign: 'center' },
            },
            {
              id: 'heading2',
              type: 'Text',
              props: { content: 'Heading 2', fontSize: 24, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'body-text',
              type: 'Text',
              props: {
                content: "Body text — update this screen's content, layout, and styling without shipping a new app version.",
                fontSize: 15,
                textAlign: 'center',
                lineHeight: 22,
                opacity: 0.6,
              },
            },
            {
              id: 'caption-text',
              type: 'Text',
              props: {
                content: 'Caption text with reduced opacity',
                fontSize: 12,
                textAlign: 'center',
                opacity: 0.4,
              },
            },
            {
              id: 'cards-row',
              type: 'XStack',
              props: { gap: 12 },
              children: [
                {
                  id: 'card-a',
                  type: 'YStack',
                  props: {
                    flex: 1,
                    padding: 16,
                    gap: 8,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#E0E0E0',
                    overflow: 'hidden',
                  },
                  children: [
                    {
                      id: 'card-a-title',
                      type: 'Text',
                      props: { content: 'YStack', fontSize: 13, fontWeight: '600' },
                    },
                    {
                      id: 'card-a-body',
                      type: 'Text',
                      props: { content: 'flex, gap, padding, border, overflow', fontSize: 12, lineHeight: 18, opacity: 0.6 },
                    },
                  ],
                },
                {
                  id: 'card-b',
                  type: 'YStack',
                  props: {
                    flex: 1,
                    padding: 16,
                    gap: 8,
                    borderWidth: 1,
                    borderRadius: 12,
                    borderColor: '#E0E0E0',
                    overflow: 'hidden',
                  },
                  children: [
                    {
                      id: 'card-b-title',
                      type: 'Text',
                      props: { content: 'XStack', fontSize: 13, fontWeight: '600' },
                    },
                    {
                      id: 'card-b-body',
                      type: 'Text',
                      props: { content: 'row layout, alignItems, justifyContent', fontSize: 12, lineHeight: 18, opacity: 0.6 },
                    },
                  ],
                },
              ],
            },
            {
              id: 'info-block',
              type: 'YStack',
              props: {
                padding: 20,
                gap: 6,
                borderRadius: 12,
                backgroundColor: '#F0F7FF',
                borderWidth: 1,
                borderColor: '#C7DEFF',
              },
              children: [
                {
                  id: 'info-label',
                  type: 'XStack',
                  props: { gap: 6, alignItems: 'center' },
                  children: [
                    {
                      id: 'info-badge',
                      type: 'YStack',
                      props: {
                        backgroundColor: '#007AFF',
                        borderRadius: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      },
                      children: [
                        {
                          id: 'info-badge-text',
                          type: 'Text',
                          props: { content: 'TIP', fontSize: 10, fontWeight: '700', color: '#fff' },
                        },
                      ],
                    },
                    {
                      id: 'info-title',
                      type: 'Text',
                      props: { content: 'Nested layouts', fontSize: 15, fontWeight: '600' },
                    },
                  ],
                },
                {
                  id: 'info-body',
                  type: 'Text',
                  props: {
                    content: 'YStack and XStack can nest infinitely. Combine with flex, gap, and backgroundColor for rich layouts.',
                    fontSize: 13,
                    lineHeight: 20,
                    opacity: 0.7,
                  },
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
