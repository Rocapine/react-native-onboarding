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
                  id: 'per-week', type: 'Text' as const,
                  props: {
                    content: 'Just {{product.yearly.pricePerWeek}} per week',
                    fontSize: 16, textAlign: 'center' as const, opacity: 0.7,
                  },
                },
                {
                  id: 'savings', type: 'Text' as const,
                  props: {
                    content: 'Save {{product.yearly.savingsPct}}% vs monthly',
                    fontSize: 14, textAlign: 'center' as const, color: '#0A7C3A',
                    renderWhen: { 'product.yearly.savingsPct': { is_not_empty: true } },
                  },
                },
                {
                  id: 'trial', type: 'Text' as const,
                  props: {
                    content: '{{product.yearly.trialDays}}-day free trial',
                    fontSize: 14, textAlign: 'center' as const, opacity: 0.6,
                    renderWhen: { 'product.yearly.trialDays': { is_not_empty: true } },
                  },
                },
                {
                  id: 'loading', type: 'Text' as const,
                  props: {
                    content: 'Loading plans…', fontSize: 14, textAlign: 'center' as const, opacity: 0.5,
                    renderWhen: { 'products.loaded': { eq: 'false' } },
                  },
                },
                {
                  id: 'plans', type: 'RadioGroup' as const,
                  props: {
                    variableName: 'plan', defaultValue: 'yearly',
                    renderWhen: { 'products.loaded': { eq: 'true' } },
                    items: [
                      { value: 'yearly', label: '{{product.yearly.title}} — {{product.yearly.price}}' },
                      { value: 'monthly', label: '{{product.monthly.title}} — {{product.monthly.price}}' },
                    ],
                  },
                },
                {
                  id: 'buy', type: 'Button' as const,
                  props: {
                    label: 'Start free trial',
                    renderWhen: { 'products.loaded': { eq: 'true' } },
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
  };

  return (
    <OnboardingUi.OnboardingPage
      step={step as any}
      onContinue={() => router.back()}
    />
  );
}
