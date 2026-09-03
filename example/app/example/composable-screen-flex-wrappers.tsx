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
    props: { ...sizing, ...behaviour, gap: 8 },
    children: [
      {
        id: `block-${trigger}-${index}`,
        type: 'YStack' as const,
        props: {
          height: 44,
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

// A wrapped `ScrollView` has to stay CLAMPED to its frame. `flexBasis: 0` was
// doing that job as well as collapsing the box, so a fill of `flexGrow` alone
// would let the scroll grow to its own content (~264pt here), overflow the
// 130pt frame and stop scrolling. The yellow frame is the height it may use.
const boundedScroll = {
  id: 'bounded-frame',
  type: 'YStack' as const,
  props: { height: 130, backgroundColor: '#FFF3B0' },
  children: [
    {
      id: 'bounded-scroll',
      type: 'ScrollView' as const,
      props: {
        flex: 1,
        // Clips at its own bounds so the capture is unambiguous: an RN
        // ScrollView on iOS does not clip by default, so an unclamped one and a
        // clamped one look alike until the content is cut at the real height.
        overflow: 'hidden' as const,
        onPress: [
          { type: 'setVariable' as const, name: 'picked', value: 'scroll', arrayOp: 'toggle' as const },
        ],
      },
      children: [0, 1, 2, 3, 4, 5].map((i) => ({
        id: `scroll-row-${i}`,
        type: 'YStack' as const,
        props: {
          height: 36,
          marginVertical: 3,
          borderRadius: 8,
          backgroundColor: i % 2 === 0 ? '#7C6BF2' : '#33B8A0',
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        children: [
          {
            id: `scroll-label-${i}`,
            type: 'Text' as const,
            props: { content: `row ${i + 1} of 6`, fontSize: 12, color: '#FFFFFF' },
          },
        ],
      })),
    },
  ],
};

// A wrapped `Carousel` measures its own box (`onLayout`) and renders nothing
// until that measurement is > 0, so it is the harshest reader of the fill
// contract: get it wrong and the element is simply absent.
const wrappedCarousel = {
  id: 'carousel',
  type: 'Carousel' as const,
  props: {
    carouselType: 'normal' as const,
    showDots: true,
    height: 110,
    borderRadius: 12,
    animation: { entering: { preset: 'FadeIn' as const, duration: 350 } },
  },
  children: [0, 1, 2].map((i) => ({
    id: `slide-${i}`,
    type: 'YStack' as const,
    props: {
      height: 110,
      borderRadius: 12,
      backgroundColor: COLORS[i % COLORS.length],
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    children: [
      {
        id: `slide-label-${i}`,
        type: 'Text' as const,
        props: { content: `slide ${i + 1}`, fontSize: 14, color: '#FFFFFF' },
      },
    ],
  })),
};

// The invariant under a microscope: one authored `flex: 1` box in a 90pt frame
// with ~137pt of content, rendered twice — WRAPPED (an `onPress`, so the
// renderer inserts a Pressable and demotes the element) and plain. The two must
// be the same height. `overflow: hidden` makes each box's real height visible
// as the line where the text is cut.
const clampFrame = (id: string, pressable: boolean) => ({
  id: `${id}-frame`,
  type: 'YStack' as const,
  props: { height: 90, backgroundColor: '#FFF3B0' },
  children: [
    {
      id: `${id}-box`,
      type: 'YStack' as const,
      props: {
        flex: 1,
        overflow: 'hidden' as const,
        borderRadius: 8,
        backgroundColor: pressable ? '#1C1C1E' : '#4A4A52',
        padding: 6,
        gap: 2,
        ...(pressable
          ? {
              onPress: [
                {
                  type: 'setVariable' as const,
                  name: 'picked',
                  value: 'clamp',
                  arrayOp: 'toggle' as const,
                },
              ],
            }
          : {}),
      },
      children: [0, 1, 2, 3, 4].map((i) => ({
        id: `${id}-line-${i}`,
        type: 'Text' as const,
        props: {
          content: `${pressable ? 'wrapped' : 'plain'} line ${i + 1}`,
          fontSize: 18,
          color: '#FFFFFF',
        },
      })),
    },
  ],
});

const captioned = <T,>(id: string, caption: string, child: T) => ({
  id,
  type: 'YStack' as const,
  props: { gap: 6 },
  children: [
    {
      id: `${id}-caption`,
      type: 'Text' as const,
      props: { content: caption, fontSize: 12, fontWeight: '600' as const, color: '#8A8A8E' },
    },
    child,
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
              // An authored ScrollView, because the reference no longer fits on
              // one screen. It does NOT mask the bug: the collapsing box is the
              // row inside it, whose own height is still auto.
              id: 'root-scroll',
              type: 'ScrollView' as const,
              props: { flex: 1, contentContainerPadding: 24 },
              children: [
            {
              id: 'root',
              type: 'YStack' as const,
              props: { gap: 18 },
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
                row('flexGrowAnim'),
                captioned(
                  'bounded',
                  'flex: 1 + onPress on a ScrollView — must stay inside the frame',
                  boundedScroll
                ),
                captioned('carousel-section', 'height + animation on a Carousel', wrappedCarousel),
                // The invariant, side by side in one frame each: a wrapped box
                // and an identical UNWRAPPED one must be the same height. Both
                // frames are 90pt; the content is ~137pt.
                captioned(
                  'clamp-wrapped',
                  'flex: 1 + onPress (WRAPPED) in a 90pt frame',
                  clampFrame('clamp-wrapped', true)
                ),
                captioned(
                  'clamp-plain',
                  'flex: 1, no wrapper — the reference',
                  clampFrame('clamp-plain', false)
                ),
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
