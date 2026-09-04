import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// The regression GUARD half of #231, separate from the repro screen
// (`composable-screen-flex-wrappers.tsx`) because every frame here has a
// definite height — which is exactly why none of it ever collapsed, and why it
// is the half that says "the fix changed nothing it should not have".
//
// Three things a wrapper must not break:
//   1. a wrapped ScrollView stays inside its frame and keeps scrolling;
//   2. a wrapped Carousel still measures its own box — it renders NOTHING if
//      that box is mis-sized, so it is the harshest reader of the contract;
//   3. a wrapped box and an identical unwrapped one are the SAME height. That
//      last one is the invariant in one picture.
const COLORS = ['#7C6BF2', '#F27B6B', '#33B8A0', '#E8B33C'];

// The one disclosed BEHAVIOUR CHANGE: `AnimatedBox` never forwarded `flexGrow`,
// so it sat inert on the inner box and the wrapper stayed content-sized. Moving
// it to the wrapper makes it take effect — these two cards were content-width
// before and split the row now. (`flexGrow` + `onPress` is unaffected: the
// `Pressable` always forwarded it.)
const flexGrowAnimRow = {
  id: 'fg-anim-row',
  type: 'XStack' as const,
  props: { gap: 16, alignItems: 'flex-start' as const, backgroundColor: '#FFF3B0' },
  children: [0, 1].map((i) => ({
    id: `fg-anim-${i}`,
    type: 'YStack' as const,
    props: {
      flexGrow: 1 as const,
      gap: 8,
      animation: { entering: { preset: 'FadeIn' as const, duration: 350 } },
    },
    children: [
      {
        id: `fg-anim-block-${i}`,
        type: 'YStack' as const,
        props: { height: 44, borderRadius: 12, backgroundColor: COLORS[i % COLORS.length] },
        children: [],
      },
      {
        id: `fg-anim-label-${i}`,
        type: 'Text' as const,
        props: { content: `flexGrow + animation ${i + 1}`, fontSize: 12, color: '#1C1C1E' },
      },
    ],
  })),
};

// A wrapped `ScrollView` must stay inside its frame. The yellow frame is the
// height it may use; `overflow: hidden` makes the real height visible as the
// line where the rows are cut.
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
// be the same height.
//
// `justifyContent: "center"` is here so the box's OWN height is observable
// rather than inferred: with the default `flex-start`, a 90pt box holding
// overflowing content and a taller box clipped to 90 paint the same first 90pt.
//
// What this pair verifies is the invariant — wrapped and unwrapped are the same
// height — and nothing more. It does NOT discriminate the fill contract's
// `flexShrink`: measured on device with and without it, every frame here is
// identical (see `wrapperLayout.ts`). Don't read a shrink regression into it.
//
// Check it with numbers, not by eye — a clipped box and an overflowing one look
// alike in a screenshot:
//   idb ui describe-all --udid <sim> | jq '.. | objects
//     | select(.AXLabel? // "" | test("wrapped line|plain line"))
//     | {AXLabel, frame}'
// The wrapped box's clipped region and the plain box's own frame must match.
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
        justifyContent: 'center' as const,
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


export default function ComposableScreenFlexWrappersContainersExample() {
  const router = useRouter();

  const step = {
    id: 'composable-flex-wrappers-containers-1',
    type: 'ComposableScreen',
    name: 'FlexWrappersContainers',
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
              props: { flex: 1, gap: 12, padding: 20 },
              children: [
                {
                  id: 'title',
                  type: 'Text' as const,
                  props: {
                    content: 'flex + wrapper: guards (#231)',
                    fontSize: 20,
                    fontWeight: '700' as const,
                    color: '#1C1C1E',
                  },
                },
                captioned(
                  'fg-anim',
                  'flexGrow: 1 + animation — behaviour CHANGE: the wrapper now grows',
                  flexGrowAnimRow
                ),
                captioned(
                  'bounded',
                  'flex: 1 + onPress on a ScrollView — stays inside the frame',
                  boundedScroll
                ),
                captioned('carousel-section', 'height + animation on a Carousel', wrappedCarousel),
                captioned(
                  'clamp-wrapped',
                  'flex: 1 + onPress (WRAPPED) in a 90pt frame',
                  clampFrame('clamp-wrapped', true)
                ),
                captioned(
                  'clamp-plain',
                  'flex: 1, no wrapper — the reference, same height required',
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
