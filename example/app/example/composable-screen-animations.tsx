import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

// A small card wrapping a label, used to show off each entering preset.
const enteringCard = (
  id: string,
  preset: string,
  delay: number,
  extra: Record<string, unknown> = {}
) => ({
  id,
  type: 'YStack' as const,
  props: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    animation: {
      entering: { preset: preset as any, duration: 500, delay, easing: 'ease-out' as const },
    },
  },
  children: [
    {
      id: `${id}-label`,
      type: 'Text' as const,
      props: { content: preset, fontSize: 14, fontWeight: '600' as const, ...extra },
    },
  ],
});

export default function ComposableScreenAnimationsExample() {
  const router = useRouter();
  // Bumping this key remounts the renderer, re-firing every `entering` animation.
  const [replayKey, setReplayKey] = useState(0);

  const step = {
    id: 'composable-screen-animations',
    type: 'ComposableScreen',
    name: 'Animations',
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
                  props: { gap: 16, padding: 24 },
                  children: [
                    // ---- Title ----
                    {
                      id: 'title',
                      type: 'Text' as const,
                      props: {
                        content: 'Animations',
                        fontSize: 30,
                        fontWeight: '700' as const,
                        animation: { entering: { preset: 'FadeInDown' as const, duration: 450 } },
                      },
                    },
                    {
                      id: 'subtitle',
                      type: 'Text' as const,
                      props: {
                        content: 'transform + animation (entering / exiting / layout / effect) — schema mirrors reanimated.',
                        fontSize: 14,
                        lineHeight: 20,
                        opacity: 0.6,
                        animation: { entering: { preset: 'FadeIn' as const, duration: 450, delay: 120 } },
                      },
                    },

                    // ---- Section: entering presets (staggered via `delay`) ----
                    {
                      id: 'sec-entering',
                      type: 'Text' as const,
                      props: { content: 'Entering — staggered by delay', fontSize: 13, fontWeight: '700' as const, opacity: 0.5, marginVertical: 4 },
                    },
                    enteringCard('e1', 'FadeInDown', 100),
                    enteringCard('e2', 'SlideInLeft', 180),
                    enteringCard('e3', 'ZoomIn', 260),
                    enteringCard('e4', 'BounceInUp', 340),
                    enteringCard('e5', 'FlipInEasyX', 420),
                    enteringCard('e6', 'RotateInDownLeft', 500),
                    enteringCard('e7', 'RollInLeft', 580),
                    enteringCard('e8', 'LightSpeedInRight', 660),
                    enteringCard('e9', 'PinwheelIn', 740),
                    enteringCard('e10', 'StretchInX', 820),

                    // ---- Section: spring vs easing ----
                    {
                      id: 'sec-spring',
                      type: 'Text' as const,
                      props: { content: 'Spring (springify) vs easing', fontSize: 13, fontWeight: '700' as const, opacity: 0.5, marginVertical: 4 },
                    },
                    {
                      id: 'spring-card',
                      type: 'YStack' as const,
                      props: {
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: '#EEF2FF',
                        animation: { entering: { preset: 'ZoomInDown' as const, duration: 600, delay: 100, spring: { damping: 9, stiffness: 170 } } },
                      },
                      children: [
                        { id: 'spring-card-label', type: 'Text' as const, props: { content: 'ZoomInDown • spring(damping 9, stiffness 170)', fontSize: 13 } },
                      ],
                    },

                    // ---- Section: continuous effects ----
                    {
                      id: 'sec-effects',
                      type: 'Text' as const,
                      props: { content: 'Effects — continuous loops', fontSize: 13, fontWeight: '700' as const, opacity: 0.5, marginVertical: 4 },
                    },
                    {
                      id: 'effects-row',
                      type: 'XStack' as const,
                      props: { gap: 16, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 8 },
                      children: [
                        {
                          id: 'fx-pulse',
                          type: 'Icon' as const,
                          props: { name: 'Heart', size: 36, color: '#FF6584', fill: '#FF6584', fillOpacity: 0.25, animation: { effect: { preset: 'pulse' as const, duration: 900, minScale: 0.85, maxScale: 1.15 } } },
                        },
                        {
                          id: 'fx-rotate',
                          type: 'Icon' as const,
                          props: { name: 'Loader', size: 36, color: '#6C63FF', animation: { effect: { preset: 'rotate' as const, duration: 1000, degrees: 360 } } },
                        },
                        {
                          id: 'fx-fade',
                          type: 'Icon' as const,
                          props: { name: 'Star', size: 36, color: '#F59E0B', fill: '#F59E0B', fillOpacity: 0.3, animation: { effect: { preset: 'fade' as const, duration: 800, minOpacity: 0.2 } } },
                        },
                        {
                          id: 'fx-bounce',
                          type: 'Icon' as const,
                          props: { name: 'ArrowDown', size: 36, color: '#10B981', animation: { effect: { preset: 'bounce' as const, duration: 600 } } },
                        },
                        {
                          id: 'fx-shimmer',
                          type: 'Icon' as const,
                          props: { name: 'Sparkles', size: 36, color: '#0EA5E9', animation: { effect: { preset: 'shimmer' as const, duration: 700 } } },
                        },
                      ],
                    },

                    // ---- Section: static transforms ----
                    {
                      id: 'sec-transform',
                      type: 'Text' as const,
                      props: { content: 'Transform — static', fontSize: 13, fontWeight: '700' as const, opacity: 0.5, marginVertical: 4 },
                    },
                    {
                      id: 'transform-row',
                      type: 'XStack' as const,
                      props: { gap: 12, justifyContent: 'space-around' as const, alignItems: 'center' as const, paddingVertical: 12 },
                      children: [
                        {
                          id: 'tf-tilt',
                          type: 'YStack' as const,
                          props: { padding: 12, borderRadius: 8, backgroundColor: '#6C63FF', transform: { rotate: -8 } },
                          children: [{ id: 'tf-tilt-l', type: 'Text' as const, props: { content: 'rotate -8°', fontSize: 12, color: '#fff', fontWeight: '600' as const } }],
                        },
                        {
                          id: 'tf-scale',
                          type: 'YStack' as const,
                          props: { padding: 12, borderRadius: 8, backgroundColor: '#FF6584', transform: { scale: 1.15 } },
                          children: [{ id: 'tf-scale-l', type: 'Text' as const, props: { content: 'scale 1.15', fontSize: 12, color: '#fff', fontWeight: '600' as const } }],
                        },
                        {
                          id: 'tf-shift',
                          type: 'YStack' as const,
                          props: { padding: 12, borderRadius: 8, backgroundColor: '#10B981', transform: { translateY: -8 } },
                          children: [{ id: 'tf-shift-l', type: 'Text' as const, props: { content: 'translateY -8', fontSize: 12, color: '#fff', fontWeight: '600' as const } }],
                        },
                      ],
                    },

                    // ---- Section: exiting + layout (toggle via renderWhen) ----
                    {
                      id: 'sec-exit',
                      type: 'Text' as const,
                      props: { content: 'Exiting + layout — toggle the card', fontSize: 13, fontWeight: '700' as const, opacity: 0.5, marginVertical: 4 },
                    },
                    {
                      id: 'toggle-row',
                      type: 'XStack' as const,
                      props: { gap: 12 },
                      children: [
                        {
                          id: 'btn-show',
                          type: 'Button' as const,
                          props: {
                            label: 'Show',
                            variant: 'outlined' as const,
                            flex: 1,
                            actions: [{ type: 'setVariable' as const, name: 'cardVisible', value: 'yes', label: 'shown' }],
                          },
                        },
                        {
                          id: 'btn-hide',
                          type: 'Button' as const,
                          props: {
                            label: 'Hide',
                            variant: 'outlined' as const,
                            flex: 1,
                            actions: [{ type: 'setVariable' as const, name: 'cardVisible', value: 'no', label: 'hidden' }],
                          },
                        },
                      ],
                    },
                    // The toggled card: enters + exits; siblings below reflow with a layout transition.
                    {
                      id: 'toggle-card',
                      renderWhen: { variable: 'cardVisible', operator: 'eq' as const, value: 'yes' },
                      type: 'YStack' as const,
                      props: {
                        padding: 20,
                        borderRadius: 16,
                        backgroundColor: '#EEF2FF',
                        animation: {
                          entering: { preset: 'SlideInDown' as const, duration: 350 },
                          exiting: { preset: 'SlideOutUp' as const, duration: 300 },
                        },
                      },
                      children: [
                        { id: 'toggle-card-t', type: 'Text' as const, props: { content: 'Now you see me', fontSize: 16, fontWeight: '700' as const } },
                        { id: 'toggle-card-b', type: 'Text' as const, props: { content: 'SlideInDown on show, SlideOutUp on hide.', fontSize: 13, opacity: 0.6 } },
                      ],
                    },
                    {
                      id: 'reflow-note',
                      type: 'YStack' as const,
                      props: {
                        padding: 16,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#C7DEFF',
                        animation: { layout: { preset: 'LinearTransition' as const, duration: 300 } },
                      },
                      children: [
                        { id: 'reflow-note-t', type: 'Text' as const, props: { content: 'This block slides up/down smoothly (LinearTransition) as the card above toggles.', fontSize: 13, opacity: 0.7 } },
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
