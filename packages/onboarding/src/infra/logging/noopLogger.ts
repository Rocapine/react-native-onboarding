import { OnboardingLogger } from "./types";

/** Default {@link OnboardingLogger} that discards every event. */
export const noopLogger: OnboardingLogger = {
  track: () => {},
};
