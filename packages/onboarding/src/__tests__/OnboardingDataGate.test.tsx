// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { Suspense, useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * The serve-time rule, end to end through a real render:
 *
 *   Audience resolution happens at serve time, and a served payload is frozen
 *   for that presentation. User-property changes apply to the NEXT serve.
 *
 * These render the real `OnboardingProvider` (react-dom under jsdom — the gate
 * has no RN-only code path; `react-native` is stubbed the way the other suites
 * stub it) against a fake client, so the assertions are about what a host
 * observes: how many times `getSteps` ran, with which audience params, and
 * whether the subtree under the provider ever unmounted.
 *
 * Every test loads a FRESH module graph (`vi.resetModules` + dynamic import):
 * the user-property store, the `OnboardingStudio` facade and the provider's
 * `QueryClient` are all module singletons, and a "next launch" is exactly a
 * fresh graph over the same persisted storage.
 */

// In-memory AsyncStorage shared across module resets, so a property persisted
// during one "launch" is there to hydrate on the next. `holdHydration` makes
// the read block until released — the window in which a host writes a property
// before the store is ready.
const storage = vi.hoisted(() => {
  const map = new Map<string, string>();
  let gate: { promise: Promise<void>; release: () => void } | null = null;
  return {
    map,
    holdHydration() {
      let release!: () => void;
      const promise = new Promise<void>((r) => (release = r));
      gate = { promise, release };
    },
    releaseHydration() {
      gate?.release();
      gate = null;
    },
    getItem: vi.fn(async (key: string) => {
      if (gate) await gate.promise;
      return map.get(key) ?? null;
    }),
    setItem: vi.fn(async (key: string, value: string) => void map.set(key, value)),
    removeItem: vi.fn(async (key: string) => void map.delete(key)),
    getAllKeys: vi.fn(async () => [...map.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => keys.forEach((k) => map.delete(k))),
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
// `OnboardingStudioClient` reads `Platform.OS`; `preloadAssets` reaches for
// `Image.prefetch`. Neither is exercised here beyond loading.
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Image: { prefetch: vi.fn(async () => true) },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Modules = {
  OnboardingProvider: typeof import("../infra/provider/OnboardingProvider").OnboardingProvider;
  OnboardingStudio: typeof import("../OnboardingStudio").OnboardingStudio;
  useOnboardingStep: typeof import("../infra/hooks/useOnboardingStep").useOnboardingStep;
  useOnboardingStart: typeof import("../infra/hooks/useOnboardingStart").useOnboardingStart;
};

/** A fresh module graph — a fresh store, facade and QueryClient — i.e. one launch. */
const launch = async (): Promise<Modules> => {
  vi.resetModules();
  const [provider, studio, step, start] = await Promise.all([
    import("../infra/provider/OnboardingProvider"),
    import("../OnboardingStudio"),
    import("../infra/hooks/useOnboardingStep"),
    import("../infra/hooks/useOnboardingStart"),
  ]);
  return {
    OnboardingProvider: provider.OnboardingProvider,
    OnboardingStudio: studio.OnboardingStudio,
    useOnboardingStep: step.useOnboardingStep,
    useOnboardingStart: start.useOnboardingStart,
  };
};

const onboarding = (id: string) =>
  ({
    metadata: { id, name: id },
    steps: [{ id: `${id}-step-1`, name: "one", type: "MediaContent", displayProgressHeader: true, payload: {} }],
    fonts: {},
  }) as any;

/**
 * A sandbox client (no disk cache, so every serve is a network call and the
 * `getSteps` spy is the whole story). Answers with an onboarding named after
 * the `plan` param it was asked for, so the assertions can tell WHICH audience
 * a payload was resolved against.
 */
const makeClient = () => {
  const getSteps = vi.fn(async (_opts: unknown, params: Record<string, string>) => ({
    data: onboarding(`for-${params.plan ?? "nobody"}`),
    headers: {
      "ONBS-Onboarding-Id": "real",
      "ONBS-Onboarding-Name": "real",
      "ONBS-Audience-Id": "real",
    },
  }));
  return { projectId: "p1", options: { isSandbox: true }, getSteps } as any;
};

// Counts mounts/unmounts of the subtree the gate guards. A `null` render by the
// gate — the defect under test — shows up here as an unmount.
const probe = { mounts: 0, unmounts: 0 };
const Probe = ({ label }: { label: string }) => {
  useEffect(() => {
    probe.mounts += 1;
    return () => {
      probe.unmounts += 1;
    };
  }, []);
  return <div data-testid="probe">{label}</div>;
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
/** Lets pending promises, effects and the store's coalesced write all land. */
const settle = async () => {
  await act(async () => {
    await flush();
    await flush();
  });
};

const render = async (element: React.ReactElement) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(element);
  });
  await settle();
};

const rerender = async (element: React.ReactElement) => {
  await act(async () => {
    root!.render(element);
  });
  await settle();
};

const unmount = async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
};

const text = () => container?.textContent ?? "";

beforeEach(() => {
  storage.map.clear();
  storage.releaseHydration();
  probe.mounts = 0;
  probe.unmounts = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  await unmount();
  vi.restoreAllMocks();
});

describe("OnboardingDataGate — audience params are pinned at serve time", () => {
  it("a user-property write after the first serve does not re-key, refetch, or unmount the subtree", async () => {
    const { OnboardingProvider, OnboardingStudio } = await launch();
    const client = makeClient();

    await render(
      <OnboardingProvider client={client} fontsFallback={<div>fallback</div>}>
        <Probe label="served" />
      </OnboardingProvider>
    );

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(text()).toBe("served");
    expect(probe.mounts).toBe(1);

    // The write that used to blank the whole app: the merged params changed, the
    // query key followed them, react-query answered `undefined` for the unseen
    // key, and the gate rendered `null`.
    await act(async () => {
      OnboardingStudio.setUserProperty("plan", "pro");
    });
    await settle();
    await act(async () => {
      OnboardingStudio.setUserProperties({ demandScore: 87 });
    });
    await settle();

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(text()).toBe("served");
    expect(probe.unmounts).toBe(0);
    expect(probe.mounts).toBe(1);
  });

  it("a `customAudienceParams` prop change after the first serve is frozen too", async () => {
    const { OnboardingProvider } = await launch();
    const client = makeClient();
    const tree = (params: Record<string, string>) => (
      <OnboardingProvider client={client} customAudienceParams={params}>
        <Probe label="served" />
      </OnboardingProvider>
    );

    await render(tree({ channel: "a" }));
    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(client.getSteps.mock.calls[0][1]).toEqual({ channel: "a" });

    await rerender(tree({ channel: "b" }));

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(text()).toBe("served");
    expect(probe.unmounts).toBe(0);
  });

  it("a write BEFORE the first serve (during hydration) is in the first fetch's params", async () => {
    storage.holdHydration();
    const { OnboardingProvider, OnboardingStudio } = await launch();
    const client = makeClient();

    await render(
      <OnboardingProvider client={client} customAudienceParams={{ plan: "prop", channel: "a" }}>
        <Probe label="served" />
      </OnboardingProvider>
    );

    // Still hydrating: nothing fetched, nothing pinned.
    expect(client.getSteps).not.toHaveBeenCalled();

    await act(async () => {
      OnboardingStudio.setUserProperty("plan", "pro");
    });
    await act(async () => {
      storage.releaseHydration();
    });
    await settle();

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    // Store wins over the prop, per key; the pin was taken from the READY
    // snapshot, not from the empty pre-hydration map.
    expect(client.getSteps.mock.calls[0][1]).toEqual({ plan: "pro", channel: "a" });
    expect(text()).toBe("served");
  });

  it("the next serve (a fresh launch) picks up properties written during the previous one", async () => {
    // Launch 1: serve, then write a property mid-flow.
    const first = await launch();
    const client1 = makeClient();
    await render(
      <first.OnboardingProvider client={client1}>
        <Probe label="served" />
      </first.OnboardingProvider>
    );
    expect(client1.getSteps.mock.calls[0][1]).toEqual({});

    await act(async () => {
      first.OnboardingStudio.setUserProperty("plan", "pro");
    });
    await settle(); // the store's coalesced write reaches "disk"
    expect(client1.getSteps).toHaveBeenCalledTimes(1);
    await unmount();

    // Launch 2: a fresh module graph hydrates from the same storage.
    const second = await launch();
    const client2 = makeClient();
    await render(
      <second.OnboardingProvider client={client2}>
        <Probe label="served again" />
      </second.OnboardingProvider>
    );

    expect(client2.getSteps).toHaveBeenCalledTimes(1);
    expect(client2.getSteps.mock.calls[0][1]).toEqual({ plan: "pro" });
    expect(text()).toBe("served again");
  });

  it("a remount of the provider is a new serve and re-resolves with the current properties", async () => {
    const { OnboardingProvider, OnboardingStudio } = await launch();
    const client = makeClient();
    const tree = (key: number) => (
      <OnboardingProvider key={key} client={client}>
        <Probe label={`serve ${key}`} />
      </OnboardingProvider>
    );

    await render(tree(1));
    await act(async () => {
      OnboardingStudio.setUserProperty("plan", "pro");
    });
    await settle();
    expect(client.getSteps).toHaveBeenCalledTimes(1);

    await rerender(tree(2));

    expect(client.getSteps).toHaveBeenCalledTimes(2);
    expect(client.getSteps.mock.calls[1][1]).toEqual({ plan: "pro" });
    expect(text()).toBe("serve 2");
  });

  it("the forced-refetch escape hatch still works, under the pinned audience, without unmounting", async () => {
    const { OnboardingProvider, OnboardingStudio } = await launch();
    const client = makeClient();

    let invalidate: (() => Promise<void>) | null = null;
    const Escape = () => {
      const queryClient = useQueryClient();
      invalidate = () => queryClient.invalidateQueries({ queryKey: ["onboardingQuestions"] });
      return null;
    };

    await render(
      <OnboardingProvider client={client} customAudienceParams={{ plan: "prop" }}>
        <Escape />
        <Probe label="served" />
      </OnboardingProvider>
    );
    expect(client.getSteps).toHaveBeenCalledTimes(1);

    // A property written mid-flow does not re-target the presentation, even
    // when the host then forces a content refresh: the refetch re-serves the
    // same pinned audience. Re-targeting is a new serve, i.e. a remount.
    await act(async () => {
      OnboardingStudio.setUserProperty("plan", "pro");
    });
    await settle();
    await act(async () => {
      await invalidate!();
    });
    await settle();

    expect(client.getSteps).toHaveBeenCalledTimes(2);
    expect(client.getSteps.mock.calls[1][1]).toEqual({ plan: "prop" });
    expect(text()).toBe("served");
    expect(probe.unmounts).toBe(0);
  });
});

describe("the step hooks read the served audience params", () => {
  it("shares the gate's query when the store is non-empty: one fetch, the store-targeted payload", async () => {
    const { OnboardingProvider, OnboardingStudio, useOnboardingStep } = await launch();
    OnboardingStudio.setUserProperty("plan", "pro");
    const client = makeClient();

    const Step = () => {
      const { onboardingMetadata } = useOnboardingStep({ stepNumber: 1 });
      return <div>{onboardingMetadata.id}</div>;
    };

    await render(
      <OnboardingProvider client={client} customAudienceParams={{ channel: "a" }}>
        <Suspense fallback={<div>suspended</div>}>
          <Step />
        </Suspense>
      </OnboardingProvider>
    );

    // Before this change the hook built its own query from the RAW prop
    // (`{ channel: "a" }`), so a non-empty store meant a second fetch under a
    // second key — and the screens rendered the payload resolved WITHOUT the
    // user's properties.
    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(client.getSteps.mock.calls[0][1]).toEqual({ channel: "a", plan: "pro" });
    expect(text()).toBe("for-pro");
  });

  it("useOnboardingStart shares it too", async () => {
    const { OnboardingProvider, OnboardingStudio, useOnboardingStart } = await launch();
    OnboardingStudio.setUserProperty("plan", "pro");
    const client = makeClient();

    const Start = () => {
      const { startStepNumber } = useOnboardingStart();
      return <div>start {startStepNumber}</div>;
    };

    await render(
      <OnboardingProvider client={client}>
        <Suspense fallback={<div>suspended</div>}>
          <Start />
        </Suspense>
      </OnboardingProvider>
    );

    expect(client.getSteps).toHaveBeenCalledTimes(1);
    expect(client.getSteps.mock.calls[0][1]).toEqual({ plan: "pro" });
    expect(text()).toBe("start 1");
  });
});
