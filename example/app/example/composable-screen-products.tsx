import * as OnboardingUi from '@rocapine/react-native-onboarding-ui';
import { stubProductProvider, type ProductRef } from '@rocapine/react-native-onboarding';
import { useRouter } from 'expo-router';

export const unstable_settings = { anchor: '(tabs)' };

// Stub catalog — invented prices, demo only. A real paywall MUST resolve prices
// from the store (App Review rejects a mismatch); see spec §2.2. Exported so
// `_layout.tsx` can wire the same provider/refs into the shared OnboardingProvider
// instead of duplicating these literals in two places.
export const CATALOG = {
  yearly: {
    productId: 'com.app.yearly', store: 'app_store' as const,
    title: 'Yearly', description: 'Best value',
    price: '$59.99', priceAmount: 59.99, currencyCode: 'USD',
    period: 'year' as const, periodCount: 1, periodIso: 'P1Y',
    trial: { period: 'week' as const, periodCount: 1, days: 7 },
  },
  monthly: {
    productId: 'com.app.monthly', store: 'app_store' as const,
    title: 'Monthly', description: 'Flexible',
    price: '$9.99', priceAmount: 9.99, currencyCode: 'USD',
    period: 'month' as const, periodCount: 1, periodIso: 'P1M',
  },
};

export const REFS: ProductRef[] = [
  { key: 'yearly', ios: 'com.app.yearly', compareTo: 'monthly' },
  { key: 'monthly', ios: 'com.app.monthly' },
];

export const provider = stubProductProvider(CATALOG);

export default function ComposableScreenProductsExample() {
  const router = useRouter();

  const step = {
    id: 'composable-screen-products',
    type: 'ComposableScreen',
    name: 'Products',
    displayProgressHeader: true,
    continueButtonLabel: 'Continue',
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
              props: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' as const },
              children: [
                {
                  id: 'title', type: 'Text' as const,
                  props: { content: 'Go Premium', fontSize: 30, fontWeight: '700' as const, textAlign: 'center' as const },
                },
                {
                  // `mode: 'expression'` is required for `{{var}}` interpolation
                  // (no auto-detection from `{{` in `content`) — this Text was
                  // missing it, so it rendered the literal, un-interpolated
                  // string on every run until now. See `website/docs/
                  // page-types.mdx` (`Text`'s `mode` prop).
                  id: 'per-week', type: 'Text' as const,
                  props: {
                    mode: 'expression' as const,
                    content: 'Just {{product.yearly.pricePerWeek}} per week',
                    fontSize: 16, textAlign: 'center' as const, opacity: 0.7,
                  },
                },
                {
                  id: 'savings', type: 'Text' as const,
                  renderWhen: { variable: 'product.yearly.savingsPct', operator: 'is_not_empty' as const },
                  props: {
                    mode: 'expression' as const,
                    content: 'Save {{product.yearly.savingsPct}}% vs monthly',
                    fontSize: 14, textAlign: 'center' as const, color: '#0A7C3A',
                  },
                },
                {
                  id: 'trial', type: 'Text' as const,
                  renderWhen: { variable: 'product.yearly.trialDays', operator: 'is_not_empty' as const },
                  props: {
                    mode: 'expression' as const,
                    content: '{{product.yearly.trialDays}}-day free trial',
                    fontSize: 14, textAlign: 'center' as const, opacity: 0.6,
                  },
                },
                {
                  id: 'loading', type: 'Text' as const,
                  renderWhen: { variable: 'products.loaded', operator: 'eq' as const, value: 'false' },
                  props: {
                    content: 'Loading plans…', fontSize: 14, textAlign: 'center' as const, opacity: 0.5,
                  },
                },
                {
                  // RadioGroup item `label` never interpolates `{{var}}` at
                  // all (unlike Text.content, there's no `mode: "expression"`
                  // opt-in for it, and no auto-detection either) — these
                  // items previously authored `{{product.yearly.title}} —
                  // {{product.yearly.price}}` as a literal label and rendered
                  // that exact un-interpolated string. Plain static labels
                  // here; live pricing is shown by the interpolated `per-week`
                  // Text above instead.
                  id: 'plans', type: 'RadioGroup' as const,
                  renderWhen: { variable: 'products.loaded', operator: 'eq' as const, value: 'true' },
                  props: {
                    variableName: 'plan', defaultValue: 'yearly',
                    items: [
                      { value: 'yearly', label: 'Yearly' },
                      { value: 'monthly', label: 'Monthly' },
                    ],
                  },
                },
                {
                  id: 'buy', type: 'Button' as const,
                  renderWhen: { variable: 'products.loaded', operator: 'eq' as const, value: 'true' },
                  props: {
                    label: 'Start free trial',
                    actions: [{ type: 'purchase', product: '{{plan}}' }],
                  },
                },
                {
                  id: 'restore', type: 'Button' as const,
                  props: {
                    label: 'Restore purchases', variant: 'ghost' as const,
                    actions: [{ type: 'restore' }],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  } satisfies OnboardingUi.ComposableScreenStepType;

  return (
    <OnboardingUi.OnboardingPage
      step={step}
      onContinue={() => router.back()}
    />
  );
}
