import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  OnboardingStudioClient,
  PaywallProvider,
  usePaywall,
  stubProductProvider,
  type Paywall,
  type PaywallCatalog,
  type ProductRef,
} from '@rocapine/react-native-onboarding';
import { PaywallHost, type UIElement } from '@rocapine/react-native-onboarding-ui';

export const unstable_settings = { anchor: '(tabs)' };

// This screen demonstrates `PaywallProvider` + `PaywallHost` + `usePaywall().present()`
// standalone — the "present a paywall on demand" half of the phase, as opposed to
// `composable-screen-products.tsx` which demonstrates purchasing INSIDE an
// onboarding step. In a real app `PaywallProvider` mounts once, above
// `OnboardingProvider`, at the app root (see `.claude/rules/composable-screen-
// runtime.md` — "Paywalls: PaywallProvider, PaywallHost, present()" for why); this
// route mounts its own instance scoped to itself purely because it is a
// self-contained example page, same as every other `app/example/*` screen not
// touching `app/_layout.tsx`.

const PLACEMENT = 'main';

// Stub catalog — invented prices, demo only, same disclaimer as
// composable-screen-products.tsx: a real paywall MUST resolve prices from the
// store (App Review rejects a mismatch); see spec §2.2.
const PRODUCT_CATALOG = {
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

const PRODUCT_REFS: ProductRef[] = [
  { key: 'yearly', ios: 'com.app.yearly', compareTo: 'monthly' },
  { key: 'monthly', ios: 'com.app.monthly' },
];

const productProvider = stubProductProvider(PRODUCT_CATALOG);

// The paywall's own elements — parsed by `PaywallHost` via `ScreenElementsSchema`,
// the same engine `OnboardingPage` uses for a `ComposableScreen` step. Exercises
// the three things this phase is actually for:
//   - a `purchase` action whose `onSuccess` chain reaches `dismiss`, so a
//     completed purchase both closes the Modal AND resolves `present()` with
//     `{ status: "purchased" }` (see `PaywallHost.tsx`'s `resolvePresentedOutcome`
//     doc for how a bare "dismissed" gets upgraded).
//   - a bare `dismiss` action ("Maybe later"), resolving `present()` with
//     `{ status: "dismissed" }`.
//   - a `renderWhen` gate on `products.loaded`, so nothing purchasable is
//     tappable before the store round-trip resolves.
const paywallElements: UIElement[] = [
  {
    id: 'safe-root',
    type: 'SafeAreaView',
    props: { flex: 1, edges: ['top', 'bottom'] },
    children: [
      {
        id: 'root',
        type: 'YStack',
        props: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
        children: [
          {
            id: 'title', type: 'Text',
            props: { content: 'Unlock Premium', fontSize: 30, fontWeight: '700', textAlign: 'center' },
          },
          {
            // `Text.content` is the one prop that interpolates `{{var}}` —
            // opt-in via `mode: "expression"` (a Button/RadioGroup `label` has
            // no such opt-in at all; that's pre-existing, unrelated to this
            // phase, and out of scope for `Runtime/` per this task's DoD), so
            // plan pricing surfaces here rather than inside the RadioGroup
            // items below.
            id: 'price', type: 'Text',
            renderWhen: { variable: 'products.loaded', operator: 'eq', value: 'true' },
            props: {
              mode: 'expression',
              content: '{{product.yearly.price}}/year · {{product.yearly.pricePerWeek}} per week',
              fontSize: 16, textAlign: 'center', opacity: 0.7,
            },
          },
          {
            id: 'loading', type: 'Text',
            renderWhen: { variable: 'products.loaded', operator: 'eq', value: 'false' },
            props: { content: 'Loading plans…', fontSize: 14, textAlign: 'center', opacity: 0.5 },
          },
          {
            id: 'plans', type: 'RadioGroup',
            renderWhen: { variable: 'products.loaded', operator: 'eq', value: 'true' },
            props: {
              variableName: 'plan', defaultValue: 'yearly',
              items: [
                { value: 'yearly', label: 'Yearly' },
                { value: 'monthly', label: 'Monthly' },
              ],
            },
          },
          {
            // `{{plan}}` resolves the RadioGroup entry's `value` ("yearly"/
            // "monthly"), not its `label` ("Yearly"/"Monthly") — `purchase`'s
            // `product` field is an identifier lookup, resolved via
            // `interpolateIdentifier` (Runtime/elements/shared.ts), not the
            // label-preferring `interpolate` used for display text.
            id: 'buy', type: 'Button',
            renderWhen: { variable: 'products.loaded', operator: 'eq', value: 'true' },
            props: {
              label: 'Start free trial',
              actions: [{ type: 'purchase', product: '{{plan}}', onSuccess: [{ type: 'dismiss' }] }],
            },
          },
          {
            id: 'maybe-later', type: 'Button',
            props: {
              label: 'Maybe later', variant: 'ghost',
              actions: [{ type: 'dismiss' }],
            },
          },
        ],
      },
    ],
  },
];

const PAYWALL: Paywall = {
  id: 'paywall-example',
  name: 'Example Paywall',
  placement: PLACEMENT,
  elements: paywallElements,
  products: PRODUCT_REFS,
  configuration: null,
};

const CATALOG: PaywallCatalog = {
  metadata: { audienceId: null, audienceName: null, locale: 'en', draft: true },
  paywalls: { [PLACEMENT]: PAYWALL },
  fonts: null,
};

// `client.getPaywalls()` is overridden below to resolve `CATALOG` directly —
// mirrors how `composable-screen-products.tsx` builds its step object inline
// rather than fetching. `OnboardingStudioClient.getPaywalls()` has no
// fallback-payload option (unlike `getSteps`), so a real client pointed at a
// project with no paywalls configured would reject; overriding it here keeps
// this example deterministic and runnable with no backend.
const client = new OnboardingStudioClient('paywall-example', {
  appVersion: '1.0.0',
  isSandbox: true,
});
client.getPaywalls = async () => ({
  data: CATALOG,
  headers: { 'ONBS-Audience-Id': null, 'ONBS-Paywall-Ids': PLACEMENT },
});

function PaywallExampleScreen() {
  const router = useRouter();
  const { present, isReady } = usePaywall();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handlePresent = async () => {
    setLastResult(null);
    const result = await present(PLACEMENT);
    setLastResult(result.status);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paywall Example</Text>
      <Text style={styles.subtitle}>
        {isReady ? 'Catalog + products ready' : 'Loading catalog…'}
      </Text>

      <Pressable
        style={[styles.button, !isReady && styles.buttonDisabled]}
        onPress={handlePresent}
      >
        <Text style={styles.buttonText}>Present Paywall</Text>
      </Pressable>

      {lastResult && (
        <Text style={styles.result}>present() resolved: "{lastResult}"</Text>
      )}

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

export default function PaywallExample() {
  return (
    <PaywallProvider client={client} productProvider={productProvider}>
      <PaywallExampleScreen />
      {/* Sibling of the screen's own content — same arrangement as the app-root
          precedent in `PaywallProvider.tsx`'s doc comment. */}
      <PaywallHost />
    </PaywallProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  button: {
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  result: {
    fontSize: 14,
    color: '#333',
  },
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
