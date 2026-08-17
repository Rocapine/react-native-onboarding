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
import { getOnboardingCacheKey } from "./infra/queries/cacheKey";
import { getPaywallsCacheKey } from "./paywalls/cacheKey";
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
   * Removes this client's cached onboarding payload AND cached paywall catalog
   * from AsyncStorage (the keys derived from `options.cacheKey`, or the
   * default keys). The next query mount or app launch is then a cache miss
   * and refetches both. To force an in-session refetch as well, also
   * invalidate the React Query keys `["onboardingQuestions", ...]` and
   * `["paywallCatalog", ...]`.
   */
  async clearCache(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(getOnboardingCacheKey(this.options.cacheKey)),
      AsyncStorage.removeItem(getPaywallsCacheKey(this.options.cacheKey)),
    ]);
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
   * `get-paywalls`. By design **omits `placement` by default** — the endpoint
   * deliberately returns every placement in one round-trip so a paywall can
   * be presented the instant the user taps upgrade, without a network call at
   * that moment (spec §6.1). Pass `paywallOptions.placement` only when a
   * single placement is genuinely all that's needed.
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
    if (paywallOptions?.placement) {
      urlParams.append("placement", paywallOptions.placement);
    }

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
          "ONBS-Audience-Id": response.headers.get("ONBS-Audience-Id"),
          "ONBS-Paywall-Ids": response.headers.get("ONBS-Paywall-Ids"),
        },
      };
    } catch (error) {
      console.error("OnboardingStudioClient getPaywalls error", error);
      throw error;
    }
  }
}
