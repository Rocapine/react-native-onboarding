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
import { readNativeAppInfo, resolveRequestIdentity } from "./requestIdentity";
import { getInstallationIdStore, resolveAssignmentId } from "./assignmentId";

export class OnboardingStudioClient {
  private baseUrl: string;
  public projectId: string;
  public options: OnboardingStudioClientOptions;
  private identity?: Record<string, string>;

  /**
   * `appVersion`, `build`, `sdkVersion`, `environment`: the params this SDK
   * adds to every request (see `requestIdentity.ts`). Memoized: none of them
   * can change while the process runs. Deliberately NOT part of any cache key:
   * a key that changed with every app update would leave a user who is offline
   * right after updating with no cached payload, and would stop a custom
   * `cacheKey` from pinning content across updates.
   */
  identityParams(): Record<string, string> {
    if (!this.identity) {
      this.identity = resolveRequestIdentity(this.options, readNativeAppInfo());
    }
    return this.identity;
  }

  /**
   * Writes the identity onto a querystring that already holds the user params.
   * `appVersion` and `build` are removed first, because the identity omits them
   * when neither the host nor `expo-application` has a value, and `set` alone
   * would then leave a same-named user param on the wire (a property persisted
   * before these names were reserved is re-read without a reserved-key check).
   */
  private async writeIdentity(urlParams: URLSearchParams): Promise<void> {
    urlParams.delete("appVersion");
    urlParams.delete("build");
    for (const [key, value] of Object.entries(this.identityParams())) {
      urlParams.set(key, value);
    }
    // Same delete-first rule: absent must mean absent, never a user param.
    urlParams.delete("assignmentId");
    const assignmentId = await this.getAssignmentId();
    if (assignmentId) urlParams.set("assignmentId", assignmentId);
  }

  /**
   * The `assignmentId` the next request will carry: the host's `assignmentId`
   * option, else the persisted installation id, else `undefined` (sent as
   * absent). Resolved per request, never memoized here, because a host getter
   * may change value on login. Never throws. See `assignmentId.ts`.
   */
  getAssignmentId(): Promise<string | undefined> {
    return resolveAssignmentId(this.options.assignmentId, getInstallationIdStore());
  }

  /**
   * Deletes the stored installation id (`rocapine-assignment-id`) and forgets
   * the in-memory one; a request already resolving it sends none. The next
   * request without a host id mints a NEW id — to stop sending one at all (e.g.
   * consent withdrawn), also make the `assignmentId` option return `false`.
   * Process-wide, like the id: same effect as `OnboardingStudio.clearAssignmentId()`.
   * Rejects if the removal fails.
   */
  clearAssignmentId(): Promise<void> {
    return getInstallationIdStore().clear();
  }

  /**
   * Races `work` against `options.timeout`, rejecting with `Error("timeout")`.
   * `work` covers identity resolution AND the fetch, so `timeout` is one
   * end-to-end budget: a slow `assignmentId` getter cannot push
   * `fallbackOnboarding` (or the rejection) past it. `work` gets an `expired()`
   * check so a request whose budget ran out while the id resolved is never
   * sent afterwards (the server would count a serve nobody receives).
   */
  private withTimeout<T>(work: (expired: () => boolean) => Promise<T>): Promise<T> {
    const ms = this.options.timeout;
    if (!ms) return work(() => false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    return Promise.race([
      work(() => timedOut),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error("timeout"));
        }, ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

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
   * the user is — that is what `OnboardingStudio.reset()` is for.
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

    // SDK-owned keys use `set`, never `append`: the server reads each with
    // `searchParams.get`, which returns the FIRST occurrence, so an appended
    // value would lose to a same-named user param added above.
    urlParams.set("projectId", this.projectId);
    urlParams.set("platform", Platform.OS);

    if (isSandbox) {
      urlParams.set("draft", "true");
    }

    // Add onboardingOptions to URL
    if (onboardingOptions?.locale) {
      urlParams.set("locale", onboardingOptions.locale);
    }

    try {
      // Identity (incl. the host's assignmentId getter) resolves inside the
      // same timeout budget as the fetch — see `withTimeout`.
      const response = await this.withTimeout(
        async (expired) => {
          await this.writeIdentity(urlParams);
          if (expired()) throw new Error("timeout");
          const url = `${this.baseUrl}/get-onboarding-steps?${urlParams.toString()}`;
          console.info("OnboardingStudioClient getSteps url", url);
          return fetch(url);
        }
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

    // SDK-owned keys use `set`, never `append` (see getSteps).
    urlParams.set("projectId", this.projectId);
    urlParams.set("platform", Platform.OS);

    if (isSandbox) {
      urlParams.set("draft", "true");
    }

    // Add paywallOptions to URL
    if (paywallOptions?.locale) {
      urlParams.set("locale", paywallOptions.locale);
    }

    // Narrows the response to a single paywall. Omitted unless explicitly
    // requested — see the method doc above.
    if (paywallOptions?.moment) {
      urlParams.set("moment", paywallOptions.moment);
    }

    // Deliberately NOT sending spec §6.1's `omitNulls=true`: it's a
    // convenience for untyped consumers that strips null-valued keys from the
    // response, which would make the runtime shape diverge from `PaywallCatalog`
    // and `Paywall`'s declared `| null` fields. This client parses into those
    // typed objects, so the fields must always be present (possibly `null`),
    // not sometimes missing.
    try {
      // Identity (incl. the host's assignmentId getter) resolves inside the
      // same timeout budget as the fetch — see `withTimeout`.
      const response = await this.withTimeout(
        async (expired) => {
          await this.writeIdentity(urlParams);
          if (expired()) throw new Error("timeout");
          const url = `${this.baseUrl}/get-paywalls?${urlParams.toString()}`;
          console.info("OnboardingStudioClient getPaywalls url", url);
          return fetch(url);
        }
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
