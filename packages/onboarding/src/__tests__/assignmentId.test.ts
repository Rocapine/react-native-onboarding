import { describe, it, expect, vi } from "vitest";
import {
  ASSIGNMENT_ID_STORAGE_KEY,
  createInstallationIdStore,
  resolveAssignmentId,
  type AssignmentIdStorage,
} from "../assignmentId";
import { ONBOARDING_CACHE_KEY_PREFIX, PAYWALLS_CACHE_KEY_PREFIX } from "../infra/queries/cacheKey";
import { USER_PROPERTIES_STORAGE_KEY } from "../userProperties/store";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  const storage = {
    getItem: vi.fn(async (k: string) => data[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      data[k] = v;
    }),
  } satisfies AssignmentIdStorage;
  return { data, storage };
};

let n = 0;
const counter = () => `generated-${++n}`;

describe("installation id store", () => {
  it("generates once, persists it, and reads it back on the next launch", async () => {
    const { data, storage } = memoryStorage();
    const first = await createInstallationIdStore(storage, counter).get();
    expect(first).toMatch(/^generated-/);
    expect(data[ASSIGNMENT_ID_STORAGE_KEY]).toBe(first);

    // A new process: a fresh store over the same disk.
    const generate = vi.fn(counter);
    const second = await createInstallationIdStore(storage, generate).get();
    expect(second).toBe(first);
    expect(generate).not.toHaveBeenCalled();
  });

  it("concurrent first calls share one id and write it once", async () => {
    const { storage } = memoryStorage();
    const store = createInstallationIdStore(storage, counter);
    const [a, b] = await Promise.all([store.get(), store.get()]);
    expect(a).toBe(b);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("a failed read is absent, and never overwrites what may be on disk", async () => {
    const { storage } = memoryStorage({ [ASSIGNMENT_ID_STORAGE_KEY]: "kept" });
    storage.getItem.mockRejectedValueOnce(new Error("disk"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createInstallationIdStore(storage, counter);
    expect(await store.get()).toBeUndefined();
    expect(storage.setItem).not.toHaveBeenCalled();
    // Not memoized: the next request retries and finds the stored id.
    expect(await store.get()).toBe("kept");
  });

  it("an id that could not be persisted is absent rather than sent", async () => {
    const { storage } = memoryStorage();
    storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createInstallationIdStore(storage, counter);
    expect(await store.get()).toBeUndefined();
    const retried = await store.get();
    expect(retried).toMatch(/^generated-/);
  });

  it("a blank stored value is replaced", async () => {
    const { storage } = memoryStorage({ [ASSIGNMENT_ID_STORAGE_KEY]: "  " });
    expect(await createInstallationIdStore(storage, counter).get()).toMatch(/^generated-/);
  });

  it("the default generator yields distinct uuid-shaped ids", async () => {
    const a = await createInstallationIdStore(memoryStorage().storage).get();
    const b = await createInstallationIdStore(memoryStorage().storage).get();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it("the default generator works without crypto.randomUUID (Hermes)", async () => {
    vi.stubGlobal("crypto", undefined);
    try {
      const id = await createInstallationIdStore(memoryStorage().storage).get();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("the key survives clearCache() and OnboardingStudio.reset()", () => {
    expect(ASSIGNMENT_ID_STORAGE_KEY.startsWith(ONBOARDING_CACHE_KEY_PREFIX)).toBe(false);
    expect(ASSIGNMENT_ID_STORAGE_KEY.startsWith(PAYWALLS_CACHE_KEY_PREFIX)).toBe(false);
    expect(ASSIGNMENT_ID_STORAGE_KEY).not.toBe(USER_PROPERTIES_STORAGE_KEY);
  });
});

describe("resolveAssignmentId", () => {
  const installation = (id: string | undefined) => ({ get: vi.fn(async () => id) });

  it("no override: the installation id", async () => {
    expect(await resolveAssignmentId(undefined, installation("inst"))).toBe("inst");
  });

  it("no override and no installation id: absent", async () => {
    expect(await resolveAssignmentId(undefined, installation(undefined))).toBeUndefined();
  });

  it("a host string wins, trimmed, and the installation id is never generated", async () => {
    const inst = installation("inst");
    expect(await resolveAssignmentId("  user-42 ", inst)).toBe("user-42");
    expect(inst.get).not.toHaveBeenCalled();
  });

  it("a host getter is called on every resolution (sync or async)", async () => {
    let current = "$RCAnonymousID:abc";
    const getter = vi.fn(async () => current);
    expect(await resolveAssignmentId(getter, installation("inst"))).toBe("$RCAnonymousID:abc");
    current = "user-42";
    expect(await resolveAssignmentId(getter, installation("inst"))).toBe("user-42");
    expect(await resolveAssignmentId(() => "sync-id", installation("inst"))).toBe("sync-id");
  });

  it.each([
    ["empty string", ""],
    ["blank", "   "],
    ["null", null],
    ["undefined", undefined],
  ])("a host value that is %s falls through to the installation id", async (_l, value) => {
    expect(await resolveAssignmentId(value as string | undefined, installation("inst"))).toBe("inst");
    expect(await resolveAssignmentId(() => value, installation("inst"))).toBe("inst");
  });

  it("false opts out: absent, and the installation id is never read, created or written", async () => {
    const inst = installation("inst");
    expect(await resolveAssignmentId(false, inst)).toBeUndefined();
    expect(await resolveAssignmentId(() => false, inst)).toBeUndefined();
    expect(await resolveAssignmentId(async () => false as const, inst)).toBeUndefined();
    expect(inst.get).not.toHaveBeenCalled();
  });

  it("a getter can opt out per request (e.g. until consent) and opt back in", async () => {
    let consented = false;
    const inst = installation("inst");
    const getter = () => (consented ? undefined : false);
    expect(await resolveAssignmentId(getter, inst)).toBeUndefined();
    expect(inst.get).not.toHaveBeenCalled();
    consented = true;
    expect(await resolveAssignmentId(getter, inst)).toBe("inst");
  });

  it("a throwing or rejecting getter falls through to the installation id", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = () => {
      throw new Error("Purchases not configured");
    };
    expect(await resolveAssignmentId(boom, installation("inst"))).toBe("inst");
    expect(await resolveAssignmentId(async () => boom(), installation("inst"))).toBe("inst");
  });

  it("a getter that never settles is abandoned after the bound, not awaited forever", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const pending = resolveAssignmentId(() => new Promise<string>(() => {}), installation("inst"));
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBe("inst");
    } finally {
      vi.useRealTimers();
    }
  });
});
