declare const __DEV__: boolean;

export const COMPOSABLE_SCREEN_DEPRECATION_WARNING =
  "[@rocapine/react-native-onboarding-ui] The ComposableScreen step type is deprecated " +
  "and will be removed in a future major version. Existing ComposableScreen steps keep " +
  "rendering unchanged. Author new steps with a built-in step type instead: MediaContent, " +
  "Question, Picker, Carousel, Loader, Ratings, Commitment or Paywall. Paywalls are not affected.";

/** A warner that emits the deprecation message at most once, and only when `isDev()`. */
export const createDeprecationWarner = (isDev: () => boolean, warn: (message: string) => void) => {
  let warned = false;
  return (): void => {
    if (warned || !isDev()) return;
    warned = true;
    warn(COMPOSABLE_SCREEN_DEPRECATION_WARNING);
  };
};

/**
 * Once per JS session, dev builds only (#353). Called from the ComposableScreen
 * STEP adapter alone: the element engine it wraps is shared with paywalls, which
 * are not deprecated and must never warn.
 */
export const warnComposableScreenDeprecated = createDeprecationWarner(
  () => typeof __DEV__ !== "undefined" && __DEV__ === true,
  (message) => console.warn(message)
);
