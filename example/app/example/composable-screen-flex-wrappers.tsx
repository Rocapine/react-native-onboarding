import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Regression reference for #231: an element carrying `flex` together with any
// wrapper trigger — `onPress`, `animation` or `transform` — used to collapse to
// height 0, because `renderElement` emitted the one authored `flex` on the
// wrapper AND on the element (RN `flex: N` implies `flexBasis: 0`, so the
// wrapper's own auto height summed to nothing). The children kept painting at
// their real size, so each row overlapped the next and every press target piled
// up on the same point.
//
// Every row here is painted YELLOW, so what the row actually RESERVES is
// visible rather than inferred: a collapsed row shows no yellow at all, a
// correct one shows a band as tall as its cards. `alignItems: 'flex-start'` is
// what leaves each card's cross size auto — legal authoring, and the condition
// under which the collapse showed.
//
// No remote images on purpose: this screen must render identically offline so
// the captures are comparable.
const COLORS = ['#7C6BF2', '#F27B6B', '#33B8A0', '#E8B33C'];

type Trigger = 'onPress' | 'animation' | 'transform' | 'flexGrow' | 'flexGrowAnim';

// One card = a flexed column with a solid block and a label under it. The block
// has a fixed height, so nothing about the collapse depends on `aspectRatio` or
// on a percentage width.
const card = (trigger: Trigger, index: number) => {
  const sizing =
    trigger === 'flexGrow' || trigger === 'flexGrowAnim'
      ? { flexGrow: 1 as const }
      : { flex: 1 as const };
  const behaviour =
    trigger === 'animation' || trigger === 'flexGrowAnim'
      ? { animation: { entering: { preset: 'FadeIn' as const, duration: 350 } } }
      : trigger === 'transform'
        ? { transform: { scale: 0.96 } }
        : {
            onPress: [
              {
                type: 'setVariable' as const,
                name: 'picked',
                value: `${trigger}-${index}`,
                arrayOp: 'toggle' as const,
              },
            ],
          };

  return {
    id: `card-${trigger}-${index}`,
    type: 'YStack' as const,
    props: { ...sizing, ...behaviour, gap: 10 },
    children: [
      {
        id: `block-${trigger}-${index}`,
        type: 'YStack' as const,
        props: {
          height: 60,
          borderRadius: 12,
          backgroundColor: COLORS[index % COLORS.length],
        },
        children: [],
      },
      {
        id: `label-${trigger}-${index}`,
        type: 'Text' as const,
        props: { content: `${trigger} ${index + 1}`, fontSize: 13, color: '#1C1C1E' },
      },
    ],
  };
};

const row = (trigger: Trigger) => ({
  id: `row-${trigger}`,
  type: 'YStack' as const,
  props: { gap: 6 },
  children: [
    {
      id: `caption-${trigger}`,
      type: 'Text' as const,
      props: {
        content:
          trigger === 'flexGrow'
            ? 'flexGrow: 1 + onPress (the workaround, always worked)'
            : trigger === 'flexGrowAnim'
              ? 'flexGrow: 1 + animation (behaviour CHANGE: the wrapper now grows)'
              : `flex: 1 + ${trigger}`,
        fontSize: 12,
        fontWeight: '600' as const,
        color: '#8A8A8E',
      },
    },
    {
      id: `cards-${trigger}`,
      type: 'XStack' as const,
      // Yellow: the height the row reserves is the height of this band.
      props: { gap: 16, alignItems: 'flex-start' as const, backgroundColor: '#FFF3B0' },
      children: [card(trigger, 0), card(trigger, 1)],
    },
  ],
});

export default function ComposableScreenFlexWrappersExample() {
  const router = useRouter();

  const step = {
    id: 'composable-flex-wrappers-1',
    type: 'ComposableScreen',
    name: 'FlexWrappers',
    displayProgressHeader: true,
    payload: {
      elements: [
        {
          id: 'safe-root',
          type: 'SafeAreaView' as const,
          props: { flex: 1, edges: ['top', 'bottom'] as ('top' | 'right' | 'bottom' | 'left')[] },
          children: [
            {
              // A plain YStack, NOT a ScrollView: an authored ScrollView masks
              // this bug outright (inside one, the available main size is
              // indefinite and a zero flex basis stops zeroing), so a repro
              // must not sit in one. The container cases live on their own
              // screen for the same reason — see
              // `composable-screen-flex-wrappers-containers.tsx`.
              id: 'root',
              type: 'YStack' as const,
              props: { flex: 1, gap: 20, padding: 24 },
              children: [
                {
                  id: 'title',
                  type: 'Text' as const,
                  props: {
                    content: 'flex + wrapper (#231)',
                    fontSize: 24,
                    fontWeight: '700' as const,
                    color: '#1C1C1E',
                  },
                },
                {
                  id: 'subtitle',
                  type: 'Text' as const,
                  props: {
                    content:
                      'Each yellow band is the height its row reserves — a collapsed row shows no band at all.',
                    fontSize: 14,
                    color: '#8A8A8E',
                  },
                },
                row('onPress'),
                row('animation'),
                row('transform'),
                row('flexGrow'),

                {
                  id: 'picked',
                  type: 'Text' as const,
                  props: {
                    content: 'Tapped: {{picked}}',
                    mode: 'expression' as const,
                    fontSize: 13,
                    color: '#1C1C1E',
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
