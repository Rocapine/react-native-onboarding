import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  OnboardingStudioClient,
  PaywallProvider,
  usePaywall,
  stubProductProvider,
  type Paywall,
  type PaywallCatalog,
  type ProductProvider,
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

// Demo-only reachability switches (Task 5, phase 7) — this screen otherwise
// has no way to exercise the failure or in-flight branches below, since
// `stubProductProvider` always resolves successfully and instantly. Two
// independent modes, each flipped by an on-screen button so a person running
// the example can reach every branch without editing code:
//   - `productMode: 'fail'` makes `getProducts` reject, driving `products.error`
//     non-empty (§10 Risk 1's failure pattern).
//   - `purchaseMode: 'slow'` makes `purchase` wait several seconds before
//     resolving, keeping `products.purchasing` `"true"` long enough to see the
//     disabled button + in-flight label (§10 Risk 6's in-flight pattern). A
//     real bug would hang forever; a fixed multi-second delay is used instead
//     so the example stays demoable — it always eventually resolves.
type DemoProductMode = 'success' | 'fail';
type DemoPurchaseMode = 'success' | 'slow';
const SLOW_PURCHASE_DELAY_MS = 6000;

const createDemoProductProvider = (
  getProductMode: () => DemoProductMode,
  getPurchaseMode: () => DemoPurchaseMode
): ProductProvider => {
  const base = stubProductProvider(PRODUCT_CATALOG);
  return {
    async getProducts(refs) {
      if (getProductMode() === 'fail') {
        throw new Error('Simulated failure: the store could not be reached.');
      }
      return base.getProducts(refs);
    },
    async purchase(product) {
      if (getPurchaseMode() === 'slow') {
        await new Promise((resolve) => setTimeout(resolve, SLOW_PURCHASE_DELAY_MS));
      }
      return base.purchase(product);
    },
    async restore() {
      return base.restore();
    },
  };
};

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
            // "Still loading" is NOT simply the opposite of "loaded".
            // `ProductStatus` is idle | loading | ready | error, and
            // `products.loaded` collapses everything that is not `ready` — so
            // it is "false" for a FAILED fetch too. Gating this branch on
            // `loaded === "false"` alone would show "Loading plans…" forever
            // after a store timeout, alongside the failure text below. The
            // second condition is what separates the two states, and it is the
            // single easiest thing to get wrong in this pattern.
            id: 'loading', type: 'Text',
            renderWhen: {
              logic: 'and',
              conditions: [
                { variable: 'products.loaded', operator: 'eq', value: 'false' },
                { variable: 'products.error', operator: 'is_empty' },
              ],
            },
            props: { content: 'Loading plans…', fontSize: 14, textAlign: 'center', opacity: 0.5 },
          },
          {
            // §10 Risk 1's named case: products FAILED, as distinct from still
            // loading. `products.error` is the only signal that distinguishes
            // them. Reachable in this example via the "Products: fail" toggle.
            id: 'load-failed', type: 'Text',
            renderWhen: { variable: 'products.error', operator: 'is_not_empty' },
            props: {
              content: "We couldn't load pricing. Please check your connection and try again later.",
              fontSize: 14, textAlign: 'center', opacity: 0.7,
            },
          },
          {
            // Deliberately `dismiss`, not a retry: the SDK exposes no way to
            // re-fetch products — there is no ButtonAction for it and nothing
            // on the runtime. A `custom` action naming some `retryProducts`
            // function would be a control that silently does nothing. Recorded
            // as a spec follow-up; do not "improve" this into a fake retry.
            id: 'load-failed-dismiss', type: 'Button',
            renderWhen: { variable: 'products.error', operator: 'is_not_empty' },
            props: { label: 'Close', variant: 'outlined', actions: [{ type: 'dismiss' }] },
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
              // §10 Risk 6's in-flight guard. Note it lives in `props`, NOT
              // beside `renderWhen` at the element level — `renderWhen` is on
              // every element, `disabledWhen` is a Button prop. Putting it one
              // level up is a type error here, but in hand-written JSON it
              // would simply be ignored and the guard would silently not exist.
              disabledWhen: { variable: 'products.purchasing', operator: 'eq', value: 'true' },
              actions: [{ type: 'purchase', product: '{{plan}}', onSuccess: [{ type: 'dismiss' }] }],
            },
          },
          {
            // The other half of Risk 6, and it is not optional. `disabledWhen`
            // alone leaves an inert button with no explanation — the user taps,
            // nothing happens, and nothing says why. This label is what turns
            // that into a state rather than a fault.
            id: 'purchasing', type: 'Text',
            renderWhen: { variable: 'products.purchasing', operator: 'eq', value: 'true' },
            props: { content: 'Completing purchase…', fontSize: 14, textAlign: 'center', opacity: 0.6 },
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
  // Refs, not state, so flipping a mode never re-creates the provider —
  // `PaywallProvider` prefetches on mount, and a new provider identity would
  // re-run that and reset the very state we are trying to observe. The provider
  // reads the CURRENT value at call time instead.
  const productMode = useRef<DemoProductMode>('success');
  const purchaseMode = useRef<DemoPurchaseMode>('success');
  const [, forceRender] = useState(0);

  const provider = useMemo(
    () => createDemoProductProvider(() => productMode.current, () => purchaseMode.current),
    []
  );

  return (
    <PaywallProvider client={client} productProvider={provider}>
      <PaywallExampleScreen />
      <View style={styles.demoToggles}>
        <Text style={styles.demoTogglesLabel}>
          Demo modes — the failure and in-flight branches are unreachable without these
        </Text>
        <Pressable
          style={styles.demoToggle}
          onPress={() => {
            productMode.current = productMode.current === 'fail' ? 'success' : 'fail';
            forceRender((n) => n + 1);
          }}
        >
          <Text style={styles.demoToggleText}>
            Products: {productMode.current === 'fail' ? 'fail' : 'succeed'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.demoToggle}
          onPress={() => {
            purchaseMode.current = purchaseMode.current === 'slow' ? 'success' : 'slow';
            forceRender((n) => n + 1);
          }}
        >
          <Text style={styles.demoToggleText}>
            Purchase: {purchaseMode.current === 'slow' ? `slow (${SLOW_PURCHASE_DELAY_MS / 1000}s)` : 'instant'}
          </Text>
        </Pressable>
      </View>
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
  demoToggles: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    gap: 8,
  },
  demoTogglesLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  demoToggle: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  demoToggleText: {
    fontSize: 13,
    color: '#3A3A3C',
  },
});
