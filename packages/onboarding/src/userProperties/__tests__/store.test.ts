import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUserPropertyStore, USER_PROPERTIES_STORAGE_KEY } from "../store";

const makeStorage = (initial: string | null = null) => {
  const store = new Map<string, string>();
  if (initial !== null) store.set(USER_PROPERTIES_STORAGE_KEY, initial);
  return {
    store,
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
  };
};

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("createUserPropertyStore", () => {
  it("starts hydrating and empty", () => {
    const s = createUserPropertyStore(makeStorage());
    expect(s.getSnapshot()).toEqual({ properties: {}, status: "hydrating" });
  });

  it("hydrates from storage and flips to ready", async () => {
    const s = createUserPropertyStore(makeStorage(JSON.stringify({ plan: "pro", days: 9 })));
    await s.ensureHydrated();
    expect(s.getSnapshot()).toEqual({ properties: { plan: "pro", days: 9 }, status: "ready" });
  });

  it("is ready even when storage holds nothing", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    expect(s.getSnapshot().status).toBe("ready");
  });

  it("is ready even when storage throws", async () => {
    const storage = makeStorage();
    storage.getItem.mockRejectedValueOnce(new Error("disk gone"));
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    expect(s.getSnapshot()).toEqual({ properties: {}, status: "ready" });
  });

  it("discards a corrupt payload rather than throwing", async () => {
    const s = createUserPropertyStore(makeStorage("not json"));
    await s.ensureHydrated();
    expect(s.getSnapshot()).toEqual({ properties: {}, status: "ready" });
  });

  it("discards a non-object payload", async () => {
    const s = createUserPropertyStore(makeStorage(JSON.stringify([1, 2, 3])));
    await s.ensureHydrated();
    expect(s.getSnapshot().properties).toEqual({});
  });

  it("drops invalid entries from a persisted payload", async () => {
    const s = createUserPropertyStore(
      makeStorage(JSON.stringify({ plan: "pro", projectId: "sneaky", nested: { a: 1 } })),
    );
    await s.ensureHydrated();
    expect(s.getSnapshot().properties).toEqual({ plan: "pro" });
  });

  it("hydrates UNDER values already set in memory", async () => {
    const s = createUserPropertyStore(makeStorage(JSON.stringify({ plan: "pro", days: 9 })));
    s.set({ plan: "free" }); // set before hydration resolves
    await s.ensureHydrated();
    // in-memory wins; disk fills the gap
    expect(s.getSnapshot().properties).toEqual({ plan: "free", days: 9 });
  });

  it("ensureHydrated reads storage once however many callers await it", async () => {
    const storage = makeStorage(JSON.stringify({ a: 1 }));
    const s = createUserPropertyStore(storage);
    await Promise.all([s.ensureHydrated(), s.ensureHydrated(), s.ensureHydrated()]);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on a real change and not on a no-op", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    const listener = vi.fn();
    s.subscribe(listener);

    s.set({ plan: "free" });
    expect(listener).toHaveBeenCalledTimes(1);

    s.set({ plan: "free" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns an identical snapshot object until something changes", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    const a = s.getSnapshot();
    expect(s.getSnapshot()).toBe(a);
    s.set({ plan: "free" });
    expect(s.getSnapshot()).not.toBe(a);
  });

  it("unsubscribes", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    const listener = vi.fn();
    s.subscribe(listener)();
    s.set({ plan: "free" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("coalesces a burst of mutations into one write", async () => {
    const storage = makeStorage();
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    storage.setItem.mockClear();

    s.set({ a: 1 });
    s.set({ b: 2 });
    s.set({ c: 3 });
    await flush();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("warns and ignores a reserved key", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    s.set({ projectId: "sneaky" });
    expect(s.get()).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("projectId"));
  });

  it("removes a single key", async () => {
    const s = createUserPropertyStore(makeStorage());
    await s.ensureHydrated();
    s.set({ a: 1, b: 2 });
    s.remove("a");
    expect(s.get()).toEqual({ b: 2 });
  });

  it("reset clears memory and deletes the persisted map", async () => {
    const storage = makeStorage();
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    s.set({ a: 1 });
    await flush();
    s.reset();
    await flush();
    expect(s.get()).toEqual({});
    expect(storage.removeItem).toHaveBeenCalledWith(USER_PROPERTIES_STORAGE_KEY);
  });

  it("does not touch storage before hydration, so it cannot clobber the disk", async () => {
    const storage = makeStorage(JSON.stringify({ persisted: "yes" }));
    const s = createUserPropertyStore(storage);
    s.set({ plan: "free" });
    await flush();
    expect(storage.setItem).not.toHaveBeenCalled();

    await s.ensureHydrated();
    await flush();
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual({
      persisted: "yes",
      plan: "free",
    });
  });

  it("survives a failed write without losing the in-memory value", async () => {
    const storage = makeStorage();
    const s = createUserPropertyStore(storage);
    await s.ensureHydrated();
    storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    s.set({ plan: "free" });
    await flush();
    expect(s.get()).toEqual({ plan: "free" });
  });
});
