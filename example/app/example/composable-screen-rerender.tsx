import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Re-render isolation repro: an autoplay, looping ProgressIndicator writes its
 * step-snapped value to `progress` on every hop (and `showLabel` re-renders each
 * frame), which re-renders the whole element tree continuously. The sibling Text
 * has a `FadeIn` entering transition — it must fade in ONCE on mount and stay put.
 *
 * Before the AnimatedBox `useMemo` fix (v1.38.2), every tree re-render handed
 * Animated.View a fresh `entering` builder, restarting the fade on every loop
 * (visible flicker). After the fix the fade holds steady while the bar loops.
 */
export default function ComposableScreenRerenderExample() {
  const router = useRouter();
  // Bumping this key remounts the renderer, re-firing the entering animations.
  const [replayKey, setReplayKey] = useState(0);

  const step = {
    id: 'composable-screen-rerender',
    type: 'ComposableScreen',
    name: 'Re-render isolation',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'safe-root',
          type: 'SafeAreaView' as const,
          props: { flex: 1, edges: ['top', 'bottom'] as ('top' | 'right' | 'bottom' | 'left')[] },
          children: [
            {
              id: 'root',
              type: 'YStack' as const,
              props: { flex: 1, gap: 20, padding: 24, justifyContent: 'center' as const },
              children: [
                {
                  id: 'title',
                  type: 'Text' as const,
                  props: {
                    content: 'Re-render isolation',
                    fontSize: 28,
                    fontWeight: '700' as const,
                    textAlign: 'center' as const,
                  },
                },
                {
                  id: 'explainer',
                  type: 'Text' as const,
                  props: {
                    content:
                      'The bar loops forever, re-rendering the tree each step. The faded text below must enter ONCE — it should not flicker as the bar loops.',
                    fontSize: 14,
                    lineHeight: 20,
                    opacity: 0.6,
                    textAlign: 'center' as const,
                  },
                },

                // Autoplay + loop + showLabel + variableName: writes `progress`
                // every step hop and re-renders each frame → continuous tree churn.
                {
                  id: 'progress-bar',
                  type: 'ProgressIndicator' as const,
                  props: {
                    variant: 'linear' as const,
                    autoplay: true,
                    loop: true,
                    variableName: 'progress',
                    initialValue: 0,
                    minValue: 0,
                    maxValue: 100,
                    step: 1,
                    duration: 2500,
                    easing: 'ease-in-out' as const,
                    thickness: 12,
                    showLabel: true,
                    marginVertical: 8,
                  },
                },

                // Reads the looping variable — proves the tree really re-renders
                // each step while the fade below stays steady.
                {
                  id: 'progress-readout',
                  type: 'Text' as const,
                  props: {
                    content: 'Live value: {{progress}}%',
                    mode: 'expression' as const,
                    fontSize: 14,
                    textAlign: 'center' as const,
                    opacity: 0.7,
                  },
                },

                // The performant alternative: AnimatedText counts to the same
                // 1,028,709 entirely on the UI thread (native TextInput) — zero
                // re-renders, no variable write, no storm. Compare to the bar above.
                {
                  id: 'animated-countup-label',
                  type: 'Text' as const,
                  props: {
                    content: 'AnimatedText (UI thread, 0 re-renders):',
                    fontSize: 13,
                    opacity: 0.5,
                    textAlign: 'center' as const,
                    marginVertical: 4,
                  },
                },
                {
                  id: 'animated-countup',
                  type: 'AnimatedText' as const,
                  props: {
                    from: 0,
                    to: 1028709,
                    duration: 2500,
                    easing: 'ease-out' as const,
                    thousandsSeparator: ',',
                    fontSize: 32,
                    fontWeight: '700' as const,
                    textAlign: 'center' as const,
                  },
                },
                // The element under test: a single fade-in on mount. With the fix
                // it does NOT restart as the bar above loops.
                {
                  id: 'fade-card',
                  type: 'YStack' as const,
                  props: {
                    padding: 20,
                    borderRadius: 16,
                    backgroundColor: '#EEF2FF',
                    animation: {
                      entering: { preset: 'FadeIn' as const, duration: 800, easing: 'ease-out' as const },
                    },
                  },
                  children: [
                    {
                      id: 'fade-text',
                      type: 'Text' as const,
                      props: {
                        content: 'I faded in once and stay put.',
                        fontSize: 16,
                        fontWeight: '600' as const,
                        textAlign: 'center' as const,
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
      {/* `key` remount re-fires the entering animations. */}
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
