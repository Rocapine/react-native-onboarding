import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingStepType } from "./steps/types";
import {
  Onboarding,
  GetStepsResponseHeaders,
  OnboardingOptions,
  OnboardingStudioClientOptions,
  UserDefinedParams,
  BaseStepType,
} from "./types";
import {
  ONBOARDING_CACHE_KEY_PREFIX,
  PAYWALLS_CACHE_KEY_PREFIX,
} from "./infra/queries/cacheKey";
import {
  PaywallCatalog,
  PaywallOptions,
  GetPaywallsResponseHeaders,
} from "./paywalls/types";

import { Platform } from "react-native";

export class OnboardingStudioClient {
  private baseUrl: string;
  public projectId: string;
  public options: OnboardingStudioClientOptions;

  constructor(projectId: string, options: OnboardingStudioClientOptions) {
    console.info("OnboardingStudioClient init: projectId ", projectId);
    this.projectId = projectId;
    this.options = options;
    this.baseUrl =
      options.baseUrl ||
      "https://takbcvjljqialzqyksic.supabase.co/functions/v1";
  }

  /**
   * Removes EVERY cached onboarding payload and paywall catalog this SDK wrote,
   * across all audience-param variants. The next query mount or app launch is
   * then a cache miss and refetches. To force an in-session refetch as well,
   * also invalidate the React Query keys `["onboardingQuestions", ...]` and
   * `["paywallCatalog", ...]`.
   *
   * Scans `getAllKeys()` by prefix rather than naming two keys, because the keys
   * are now scoped by a hash of the resolved audience params (see
   * `infra/queries/cacheKey.ts`) — so there is no longer one key per domain to
   * name. This also picks up entries written before that scoping existed, which
   * would otherwise be orphaned forever.
   *
   * It does NOT clear user properties: `USER_PROPERTIES_STORAGE_KEY` matches
   * neither prefix, deliberately. Clearing a payload cache must not forget who
   * the user is — that is what `userProperties.reset()` is for.
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter(
        (key) =>
          key.startsWith(ONBOARDING_CACHE_KEY_PREFIX) ||
          key.startsWith(PAYWALLS_CACHE_KEY_PREFIX),
      );
      if (ours.length > 0) await AsyncStorage.multiRemove(ours);
    } catch (error) {
      console.warn("Failed to clear SDK caches:", error);
    }
  }

  async getSteps<StepType extends BaseStepType = OnboardingStepType>(
    onboardingOptions?: OnboardingOptions,
    userDefinedParams?: UserDefinedParams
  ): Promise<{ data: Onboarding<StepType>; headers: GetStepsResponseHeaders }> {
    console.info("OnboardingStudioClient getSteps");
    const isSandbox = this.options.isSandbox;

    const urlParams = new URLSearchParams();
    // Add userDefinedParams to URL
    if (userDefinedParams) {
      Object.entries(userDefinedParams).forEach(([key, value]) => {
        urlParams.append(key, value);
      });
    }

    urlParams.append("projectId", this.projectId);
    urlParams.append("platform", Platform.OS);

    const appVersion = this.options.appVersion; // TODO get the version from the expo app
    if (appVersion) {
      urlParams.append("appVersion", appVersion);
    }

    if (isSandbox) {
      urlParams.append("draft", "true");
    }

    // Add onboardingOptions to URL
    if (onboardingOptions?.locale) {
      urlParams.append("locale", onboardingOptions.locale);
    }

    const url = `${this.baseUrl}/get-onboarding-steps?${urlParams.toString()}`;
    console.info("OnboardingStudioClient getSteps url", url);
    try {
      const response = await Promise.race(
        this.options.timeout
          ? [
              fetch(url),
              new Promise<Response>((_, reject) =>
                setTimeout(
                  () => reject(new Error("timeout")),
                  this.options.timeout
                )
              ),
            ]
          : [fetch(url)]
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch onboarding steps: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      return {
        data,
        headers: {
          "ONBS-Onboarding-Id": response.headers.get("ONBS-Onboarding-Id"),
          "ONBS-Audience-Id": response.headers.get("ONBS-Audience-Id"),
          "ONBS-Onboarding-Name": response.headers.get("ONBS-Onboarding-Name"),
        },
      };
    } catch (error) {
      console.error("OnboardingStudioClient getSteps error", error);
      if (this.options.fallbackOnboarding) {
        console.warn("OnboardingStudioClient getSteps fallback onboarding");
        return {
          data: this.options.fallbackOnboarding as Onboarding<StepType>,
          headers: {
            "ONBS-Onboarding-Id": "fallback",
            "ONBS-Audience-Id": "fallback",
            "ONBS-Onboarding-Name": "fallback",
          },
        };
      }
      throw error;
    }
  }

  /**
   * Fetches the paywall catalog for this project/audience/locale from
   * `get-paywalls`. By design **omits `moment` by default** — the endpoint
   * deliberately returns every moment in one round-trip so a paywall can
   * be presented the instant the user taps upgrade, without a network call at
   * that moment (spec §6.1). Pass `paywallOptions.moment` only when a
   * single moment is genuinely all that's needed.
   *
   * Unlike `getSteps`, there is no fallback-payload option here: a
   * non-`ok` response or a network failure always rejects rather than
   * resolving to a stand-in catalog.
   */
  async getPaywalls(
    paywallOptions?: PaywallOptions,
    userDefinedParams?: UserDefinedParams
  ): Promise<{ data: PaywallCatalog; headers: GetPaywallsResponseHeaders }> {
    console.info("OnboardingStudioClient getPaywalls");
    const isSandbox = this.options.isSandbox;

    const urlParams = new URLSearchParams();
    // Add userDefinedParams to URL
    if (userDefinedParams) {
      Object.entries(userDefinedParams).forEach(([key, value]) => {
        urlParams.append(key, value);
      });
    }

    urlParams.append("projectId", this.projectId);
    urlParams.append("platform", Platform.OS);

    const appVersion = this.options.appVersion; // TODO get the version from the expo app
    if (appVersion) {
      urlParams.append("appVersion", appVersion);
    }

    if (isSandbox) {
      urlParams.append("draft", "true");
    }

    // Add paywallOptions to URL
    if (paywallOptions?.locale) {
      urlParams.append("locale", paywallOptions.locale);
    }

    // Narrows the response to a single paywall. Omitted unless explicitly
    // requested — see the method doc above.
    if (paywallOptions?.moment) {
      urlParams.append("moment", paywallOptions.moment);
    }

    // Deliberately NOT sending spec §6.1's `omitNulls=true`: it's a
    // convenience for untyped consumers that strips null-valued keys from the
    // response, which would make the runtime shape diverge from `PaywallCatalog`
    // and `Paywall`'s declared `| null` fields. This client parses into those
    // typed objects, so the fields must always be present (possibly `null`),
    // not sometimes missing.
    const url = `${this.baseUrl}/get-paywalls?${urlParams.toString()}`;
    console.info("OnboardingStudioClient getPaywalls url", url);
    try {
      const response = await Promise.race(
        this.options.timeout
          ? [
              fetch(url),
              new Promise<Response>((_, reject) =>
                setTimeout(
                  () => reject(new Error("timeout")),
                  this.options.timeout
                )
              ),
            ]
          : [fetch(url)]
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch paywalls: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      return {
        data,
        headers: {
          "ONBS-Audience-Ids": response.headers.get("ONBS-Audience-Ids"),
          "ONBS-Paywall-Ids": response.headers.get("ONBS-Paywall-Ids"),
        },
      };
    } catch (error) {
      console.error("OnboardingStudioClient getPaywalls error", error);
      throw error;
    }
  }
}
