import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

// A card that BOTH enters (reanimated `entering` builder) AND carries a static
// `transform`. Each card pairs an entering preset with a persistent transform.
// Before the fix, reanimated's entering builder owned the wrapper's transform
// for the duration of the entry, so the static transform only snapped in after
// the animation finished. Now AnimatedBox nests the two onto separate views, so
// the transform is applied from frame 0 and the entry plays on top of it.
// Hit ↻ Replay to remount and re-fire every entry — the tilt/scale must hold
// the whole time, never snapping at the end.
const card = (
  id: string,
  label: string,
  preset: string,
  transform: Record<string, number>,
  delay: number,
  color: string
) => ({
  id,
  type: 'YStack' as const,
  props: {
    padding: 18,
    gap: 4,
    borderRadius: 16,
    alignSelf: 'center' as const,
    backgroundColor: color,
    transform,
    animation: {
      entering: { preset: preset as any, duration: 600, delay, easing: 'ease-out' as const },
    },
  },
  children: [
    {
      id: `${id}-label`,
      type: 'Text' as const,
      props: { content: label, fontSize: 15, fontWeight: '700' as const, color: '#fff', textAlign: 'center' as const },
    },
    {
      id: `${id}-sub`,
      type: 'Text' as const,
      props: { content: `${preset} + ${Object.entries(transform).map(([k, v]) => `${k} ${v}`).join(', ')}`, fontSize: 12, color: '#fff', opacity: 0.8, textAlign: 'center' as const },
    },
  ],
});

export default function ComposableScreenAnimTransformExample() {
  const router = useRouter();
  // Bumping this key remounts the renderer, re-firing every `entering` animation.
  const [replayKey, setReplayKey] = useState(0);

  const step = {
    id: 'composable-screen-anim-transform',
    type: 'ComposableScreen',
    name: 'Entering + Transform',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'safe-root',
          type: 'SafeAreaView' as const,
          props: { flex: 1, edges: ['top', 'bottom'] as ('top' | 'right' | 'bottom' | 'left')[] },
          children: [
            {
              id: 'scroll-root',
              type: 'ScrollView' as const,
              props: { flex: 1, showsVerticalScrollIndicator: false },
              children: [
                {
                  id: 'root',
                  type: 'YStack',
                  props: { gap: 20, padding: 24 },
                  children: [
                    {
                      id: 'title',
                      type: 'Text' as const,
                      props: {
                        content: 'Entering + Transform',
                        fontSize: 28,
                        fontWeight: '700' as const,
                      },
                    },
                    {
                      id: 'subtitle',
                      type: 'Text' as const,
                      props: {
                        content: 'Each card enters AND holds a static transform from frame 0 — the transform no longer waits for the entry to finish. Hit ↻ Replay.',
                        fontSize: 14,
                        lineHeight: 20,
                        opacity: 0.6,
                      },
                    },
                    card('c1', 'Fade in + tilt', 'FadeInDown', { rotate: -4 }, 150, '#1E293B'),
                    card('c2', 'Slide in + scale', 'SlideInLeft', { scale: 1.1 }, 300, '#6C63FF'),
                    card('c3', 'Zoom in + tilt + scale', 'ZoomIn', { rotate: 5, scale: 1.05 }, 450, '#E11D48'),
                    card('c4', 'Bounce in + shift', 'BounceInUp', { translateY: -6 }, 600, '#10B981'),
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
      {/* `key` remount re-fires every entering animation. */}
      <OnboardingUi.ComposableScreenRenderer key={replayKey} step={step} onContinue={() => router.back()} />
      <Pressable style={styles.replayButton} onPress={() => setReplayKey((k) => k + 1)}>
        <Text style={styles.replayButtonText}>↻ Replay</Text>
      </Pressable>
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
  replayButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: 14,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  replayButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
