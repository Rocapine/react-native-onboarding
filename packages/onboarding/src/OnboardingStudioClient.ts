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
   * Removes this client's cached onboarding payload from AsyncStorage (the key
   * derived from `options.cacheKey`, or the default key). The next query mount
   * or app launch is then a cache miss and refetches. To force an in-session
   * refetch as well, also invalidate the React Query key
   * `["onboardingQuestions", ...]`.
   */
  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(getOnboardingCacheKey(this.options.cacheKey));
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
}
