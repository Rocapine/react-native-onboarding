import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// 2×2 grid of tappable image cards, each with a checkbox circle + label below.
// Tapping a card toggles its value into the `symptoms` multi-select variable via
// the generic `onPress` + `setVariable` `arrayOp: "toggle"` — the same JSON-`string[]`
// encoding CheckboxGroup uses, so `renderWhen: { operator: "contains" }` fills the
// circle when selected, and `disabledWhen: is_empty` gates the CTA. No CheckboxGroup
// widget — built entirely from the generic onPress action on plain Stacks.
const ITEMS = [
  { value: 'energy', label: 'Energy drops', url: 'https://picsum.photos/seed/energy/500/500' },
  { value: 'emotions', label: 'Emotions overflow', url: 'https://picsum.photos/seed/emotions/500/500' },
  { value: 'cravings', label: 'Cravings take over', url: 'https://picsum.photos/seed/cravings/500/500' },
  { value: 'sleep', label: 'Sleep slipping', url: 'https://picsum.photos/seed/sleep/500/500' },
];

const card = (item: (typeof ITEMS)[number]) => ({
  id: `card-${item.value}`,
  type: 'YStack' as const,
  props: {
    flex: 1,
    gap: 10,
    // Tap the whole card → toggle this value in/out of `symptoms`.
    onPress: [
      {
        type: 'setVariable' as const,
        name: 'symptoms',
        value: item.value,
        label: item.label,
        arrayOp: 'toggle' as const,
      },
    ],
  },
  children: [
    {
      id: `img-${item.value}`,
      type: 'Image' as const,
      props: {
        url: item.url,
        width: '100%',
        aspectRatio: 1,
        borderRadius: 18,
        resizeMode: 'cover' as const,
      },
    },
    {
      id: `row-${item.value}`,
      type: 'XStack' as const,
      props: { alignItems: 'center' as const, gap: 10 },
      children: [
        {
          id: `circle-${item.value}`,
          type: 'YStack' as const,
          props: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: '#C9C4BC',
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            overflow: 'hidden' as const,
          },
          children: [
            // Filled dark dot + check, shown only while this value is selected.
            {
              id: `dot-${item.value}`,
              type: 'YStack' as const,
              renderWhen: { variable: 'symptoms', operator: 'contains' as const, value: item.value },
              props: {
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#1C1C1E',
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
              },
              children: [
                { id: `check-${item.value}`, type: 'Icon' as const, props: { name: 'Check', size: 14, color: '#FFFFFF' } },
              ],
            },
          ],
        },
        {
          id: `label-${item.value}`,
          type: 'Text' as const,
          props: { content: item.label, fontSize: 16, color: '#1C1C1E', flexShrink: 1 },
        },
      ],
    },
  ],
});

const row = (id: string, items: typeof ITEMS) => ({
  id,
  type: 'XStack' as const,
  props: { gap: 16, alignItems: 'flex-start' as const },
  children: items.map(card),
});

export default function ComposableScreenGridSelectExample() {
  const router = useRouter();

  const step = {
    id: 'composable-grid-select-1',
    type: 'ComposableScreen',
    name: 'GridSelect',
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
              props: { flex: 1, gap: 20, padding: 24 },
              children: [
                {
                  id: 'title',
                  type: 'Text' as const,
                  props: { content: 'What have you noticed lately?', fontSize: 26, fontWeight: '700', color: '#1C1C1E' },
                },
                {
                  id: 'subtitle',
                  type: 'Text' as const,
                  props: { content: 'Tap all that apply', fontSize: 16, color: '#8A8A8E' },
                },
                // Grid: a YStack of two XStack rows, each row holding two flex:1 cards.
                {
                  id: 'grid',
                  type: 'YStack' as const,
                  props: { gap: 16 },
                  children: [
                    row('grid-row-1', [ITEMS[0], ITEMS[1]]),
                    row('grid-row-2', [ITEMS[2], ITEMS[3]]),
                  ],
                },
                // The complement of the selection, rendered from the SAME catalog:
                // one `Repeat` over every item, each row gated by `not_in` against
                // the `symptoms` multi-select. `symptoms` holds the JSON-`string[]`
                // the toggle action writes, so the right-hand side is a reference to
                // a list rather than an authored array (issue #225) — before that fix
                // `not_in` was true for every row and this strip showed the whole
                // catalog even with everything selected.
                {
                  id: 'remaining-label',
                  type: 'Text' as const,
                  renderWhen: { variable: 'symptoms', operator: 'is_not_empty' as const },
                  props: { content: 'Not selected', fontSize: 13, color: '#8A8A8E' },
                },
                {
                  id: 'remaining',
                  // Gated on the SAME condition as its heading: with nothing
                  // selected the complement is the whole catalog, so an ungated
                  // strip would render all four chips under no heading — exactly
                  // what `main` renders, which would make this screen unable to
                  // show the fix at all. (With everything selected the heading
                  // shows above an empty strip; that is the honest end state.)
                  renderWhen: { variable: 'symptoms', operator: 'is_not_empty' as const },
                  type: 'XStack' as const,
                  props: { gap: 8, flexWrap: 'wrap' as const },
                  children: [
                    {
                      id: 'remaining-rows',
                      type: 'Repeat' as const,
                      props: { keyField: 'value', data: ITEMS.map(({ value, label }) => ({ value, label })) },
                      children: [
                        {
                          id: 'remaining-chip',
                          type: 'Text' as const,
                          renderWhen: { variable: 'item.value', operator: 'not_in' as const, value: '{{symptoms}}' },
                          props: {
                            content: '{{item.label}}',
                            mode: 'expression' as const,
                            fontSize: 13,
                            color: '#1C1C1E',
                            backgroundColor: '#EFEDE9',
                            borderRadius: 12,
                            paddingVertical: 6,
                            paddingHorizontal: 12,
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
