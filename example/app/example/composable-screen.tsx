import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-1',
    type: 'ComposableScreen',
    name: 'ComposableScreen',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 24, padding: 24 },
          children: [
            // Lottie animation
            {
              id: 'hero-lottie',
              type: 'Lottie',
              props: {
                source: 'https://raw.githubusercontent.com/airbnb/lottie-web/master/demo/adrock/data.json',
                height: 180,
                autoPlay: true,
                loop: true,
              },
            },
            // Rive animation
            {
              id: 'hero-rive',
              type: 'Rive',
              props: {
                url: 'https://cdn.rive.app/animations/vehicles.riv',
                height: 180,
                autoplay: true,
                fit: 'Contain',
              },
            },
            // Hero image
            {
              id: 'hero-image',
              type: 'Image',
              props: {
                url: 'https://picsum.photos/800/400?grayscale',
                height: 180,
                resizeMode: 'cover',
                borderRadius: 16,
              },
            },
            // Header text
            {
              id: 'headline',
              type: 'Text',
              props: {
                content: 'Built from the CMS',
                fontSize: 28,
                fontWeight: '700',
                textAlign: 'center',
              },
            },
            {
              id: 'subheadline',
              type: 'Text',
              props: {
                content: 'This screen is composed entirely from a JSON payload — no custom renderer needed.',
                fontSize: 15,
                textAlign: 'center',
                lineHeight: 22,
                opacity: 0.6,
              },
            },
            // Feature cards row
            {
              id: 'cards-row',
              type: 'XStack',
              props: { gap: 12 },
              children: [
                {
                  id: 'card-layout',
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
                      id: 'card-layout-title',
                      type: 'Text',
                      props: { content: 'Layout', fontSize: 13, fontWeight: '600' },
                    },
                    {
                      id: 'card-layout-body',
                      type: 'Text',
                      props: {
                        content: 'YStack, XStack with flex, gap, padding & margin',
                        fontSize: 12,
                        lineHeight: 18,
                        opacity: 0.6,
                      },
                    },
                  ],
                },
                {
                  id: 'card-border',
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
                      id: 'card-border-title',
                      type: 'Text',
                      props: { content: 'Borders', fontSize: 13, fontWeight: '600' },
                    },
                    {
                      id: 'card-border-body',
                      type: 'Text',
                      props: {
                        content: 'borderWidth, borderRadius, borderColor, overflow',
                        fontSize: 12,
                        lineHeight: 18,
                        opacity: 0.6,
                      },
                    },
                  ],
                },
              ],
            },
            // Highlighted info block
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
                          props: { content: 'NEW', fontSize: 10, fontWeight: '700', color: '#fff' },
                        },
                      ],
                    },
                    {
                      id: 'info-title',
                      type: 'Text',
                      props: { content: 'ComposableScreen', fontSize: 15, fontWeight: '600' },
                    },
                  ],
                },
                {
                  id: 'info-body',
                  type: 'Text',
                  props: {
                    content: 'Update this screen\'s content, layout, and styling without shipping a new app version.',
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
