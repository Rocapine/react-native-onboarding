/**
 * Navigation abstraction injected into the SDK so it does not hard-depend on
 * any particular navigation library (expo-router, react-navigation, custom).
 * The default implementation binds to expo-router when present
 * (see `expoRouterAdapter`); hosts can override it via
 * `OnboardingProvider`'s `navigation` prop.
 */
export interface OnboardingNavigationAdapter {
  /** Hook: re-run `effect` when the screen gains focus (expo-router `useFocusEffect` semantics). */
  useFocusEffect: (effect: () => void | (() => void)) => void;
  /** Hook: returns back-navigation controls. */
  useRouter: () => { canGoBack: () => boolean; goBack: () => void };
}
