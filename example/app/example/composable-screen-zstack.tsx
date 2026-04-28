import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function ComposableScreenZStackExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-zstack',
    type: 'ComposableScreen',
    name: 'ComposableScreen — ZStack',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'root',
          type: 'YStack',
          props: { gap: 20, padding: 24 },
          children: [
            {
              id: 'section-title',
              type: 'Text',
              props: { content: 'ZStack', fontSize: 22, fontWeight: '700', textAlign: 'center' },
            },
            {
              id: 'section-subtitle',
              type: 'Text',
              props: {
                content: 'Children stack in Z-axis. First child = bottom layer.',
                fontSize: 14,
                textAlign: 'center',
                opacity: 0.55,
              },
            },
            // Full-bleed hero: image + gradient scrim + text overlay
            {
              id: 'hero-zstack',
              type: 'ZStack',
              props: {
                height: 260,
                borderRadius: 20,
                overflow: 'hidden',
                marginVertical: 4,
              },
              children: [
                {
                  id: 'hero-bg',
                  type: 'Image',
                  props: {
                    url: 'https://picsum.photos/800/520?random=42',
                    height: 260,
                    resizeMode: 'cover',
                  },
                },
                {
                  id: 'hero-scrim',
                  type: 'YStack',
                  props: {
                    backgroundGradient: {
                      type: 'linear',
                      from: 'bottom',
                      to: 'top',
                      stops: [
                        { color: 'rgba(0,0,0,0.72)', position: 0 },
                        { color: 'rgba(0,0,0,0)', position: 1 },
                      ],
                    },
                    padding: 24,
                    paddingVertical: 24,
                    justifyContent: 'flex-end',
                  },
                  children: [
                    {
                      id: 'hero-tag',
                      type: 'YStack',
                      props: {
                        backgroundColor: '#007AFF',
                        borderRadius: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        alignSelf: 'flex-start',
                        marginVertical: 8,
                      },
                      children: [
                        {
                          id: 'hero-tag-text',
                          type: 'Text',
                          props: { content: 'FEATURED', fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1 },
                        },
                      ],
                    },
                    {
                      id: 'hero-title',
                      type: 'Text',
                      props: { content: 'Image with gradient overlay', fontSize: 22, fontWeight: '700', color: '#fff' },
                    },
                    {
                      id: 'hero-body',
                      type: 'Text',
                      props: {
                        content: 'The gradient scrim lives in the second layer of the ZStack.',
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.8)',
                        lineHeight: 20,
                        marginVertical: 6,
                      },
                    },
                  ],
                },
              ],
            },
            // Badge overlay: image + corner badge
            {
              id: 'badge-label',
              type: 'Text',
              props: { content: 'Corner badge overlay', fontSize: 15, fontWeight: '600' },
            },
            {
              id: 'badge-zstack',
              type: 'ZStack',
              props: {
                height: 160,
                borderRadius: 16,
                overflow: 'hidden',
              },
              children: [
                {
                  id: 'badge-bg',
                  type: 'Image',
                  props: {
                    url: 'https://picsum.photos/800/320?random=7',
                    height: 160,
                    resizeMode: 'cover',
                  },
                },
                {
                  id: 'badge-container',
                  type: 'YStack',
                  props: {
                    padding: 12,
                    alignItems: 'flex-end',
                    justifyContent: 'flex-start',
                  },
                  children: [
                    {
                      id: 'badge-pill',
                      type: 'YStack',
                      props: {
                        backgroundColor: '#FF3B30',
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      },
                      children: [
                        {
                          id: 'badge-text',
                          type: 'Text',
                          props: { content: 'NEW', fontSize: 12, fontWeight: '800', color: '#fff' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            // Solid color background + centered content
            {
              id: 'solid-label',
              type: 'Text',
              props: { content: 'Solid background + centered text', fontSize: 15, fontWeight: '600' },
            },
            {
              id: 'solid-zstack',
              type: 'ZStack',
              props: {
                height: 120,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundGradient: {
                  type: 'linear',
                  from: 'topLeft',
                  to: 'bottomRight',
                  stops: [
                    { color: '#6C63FF' },
                    { color: '#FF6584' },
                  ],
                },
              },
              children: [
                {
                  id: 'solid-content',
                  type: 'YStack',
                  props: {
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  },
                  children: [
                    {
                      id: 'solid-title',
                      type: 'Text',
                      props: { content: 'Gradient background', fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
                    },
                    {
                      id: 'solid-sub',
                      type: 'Text',
                      props: { content: 'via backgroundGradient on ZStack', fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
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
