import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Reproduces the Figma "Welcome Screen" progressive-blur hero: a full-bleed
// photo that stays sharp up top and blurs toward the bottom (gradient-masked
// blur), with a near-invisible scrim and sharp serif headline + CTA on top.
export default function ComposableScreenBlurExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-blur',
    type: 'ComposableScreen',
    name: 'ComposableScreen — Progressive Blur',
    displayProgressHeader: false,
    payload: {
      elements: [
        {
          id: 'welcome-root',
          type: 'ZStack',
          props: { flex: 1 },
          children: [
            // Layer 1 — full-bleed photo with gradient-masked blur baked in.
            {
              id: 'bg-blur',
              type: 'ProgressiveBlurImage',
              props: {
                flex: 1,
                url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=900&q=80',
                resizeMode: 'cover',
                intensity: 60,
                tint: 'dark',
                maxBlurOpacity: 0.8,
                mask: {
                  from: 'top',
                  to: 'bottom',
                  stops: [
                    { position: 0, opacity: 0 },
                    { position: 0.4, opacity: 0 },
                    { position: 1, opacity: 1 },
                  ],
                },
              },
            },
            // Layer 2 — near-invisible scrim (matches the Figma 0.01 black layer).
            {
              id: 'scrim',
              type: 'YStack',
              props: { flex: 1, backgroundColor: 'rgba(0,0,0,0.01)' },
              children: [],
            },
            // Layer 3 — sharp foreground content.
            {
              id: 'foreground',
              type: 'SafeAreaView',
              props: { flex: 1 },
              children: [
                {
                  id: 'foreground-layout',
                  type: 'YStack',
                  props: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
                  children: [
                {
                  id: 'top',
                  type: 'YStack',
                  props: { gap: 12, paddingVertical: 8 },
                  children: [
                    {
                      id: 'top-bar',
                      type: 'XStack',
                      props: { alignItems: 'center', justifyContent: 'space-between' },
                      children: [
                        {
                          id: 'partner-pill',
                          type: 'YStack',
                          props: {
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.9)',
                            borderRadius: 100,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          },
                          children: [
                            {
                              id: 'partner-pill-text',
                              type: 'Text',
                              props: { content: "I'm a partner", fontSize: 15, fontWeight: '500', color: '#fff' },
                            },
                          ],
                        },
                        {
                          id: 'brand-icon',
                          type: 'Icon',
                          props: { name: 'Sparkles', size: 36, color: '#fff' },
                        },
                        {
                          id: 'login-pill',
                          type: 'YStack',
                          props: {
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.9)',
                            borderRadius: 100,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                          },
                          children: [
                            {
                              id: 'login-pill-text',
                              type: 'Text',
                              props: { content: 'Log in', fontSize: 15, fontWeight: '500', color: '#fff' },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'social-proof',
                      type: 'Text',
                      props: { content: '+1,028,709  women on Harmony', fontSize: 15, color: '#fff', textAlign: 'center' },
                    },
                  ],
                },
                {
                  id: 'headline',
                  type: 'YStack',
                  props: { gap: 12, alignItems: 'center' },
                  children: [
                    {
                      id: 'headline-1',
                      type: 'Text',
                      props: { content: "You're not", fontSize: 48, color: '#fff', textAlign: 'center' },
                    },
                    {
                      id: 'headline-2',
                      type: 'Text',
                      props: { content: 'moody.', fontSize: 48, fontWeight: '700', fontStyle: 'italic', color: '#fff', textAlign: 'center' },
                    },
                    {
                      id: 'divider',
                      type: 'YStack',
                      props: { width: 40, height: 1.5, backgroundColor: '#fff', marginVertical: 8 },
                      children: [],
                    },
                    {
                      id: 'headline-3',
                      type: 'Text',
                      props: { content: "You're", fontSize: 48, color: '#fff', textAlign: 'center' },
                    },
                    {
                      id: 'headline-4',
                      type: 'Text',
                      props: { content: 'cyclical.', fontSize: 48, fontWeight: '700', fontStyle: 'italic', color: '#fff', textAlign: 'center' },
                    },
                  ],
                },
                {
                  id: 'cta',
                  type: 'YStack',
                  props: { gap: 16, alignItems: 'center', paddingVertical: 40 },
                  children: [
                    {
                      id: 'cta-caption',
                      type: 'Text',
                      props: { content: "Let's show you the difference", fontSize: 15, color: '#fff', textAlign: 'center' },
                    },
                    {
                      id: 'cta-button',
                      type: 'Button',
                      props: {
                        label: 'Continue',
                        action: 'continue',
                        backgroundColor: '#fff',
                        color: '#000',
                        borderRadius: 2000,
                        paddingHorizontal: 48,
                        paddingVertical: 16,
                        // Drop shadow lifts the CTA off the blurred photo.
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 16,
                        elevation: 10,
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
