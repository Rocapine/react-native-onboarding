import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
const disk = vi.hoisted(() => ({ data: {} as Record<string, string> }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.data[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      disk.data[k] = v;
    }),
    removeItem: vi.fn(async (k: string) => {
      delete disk.data[k];
    }),
    getAllKeys: vi.fn(async () => []),
    multiRemove: vi.fn(async () => {}),
  },
}));

import {
  ASSIGNMENT_ID_STORAGE_KEY,
  STORAGE_OP_TIMEOUT_MS,
  createInstallationIdStore,
  resolveAssignmentId,
  __resetInstallationIdForTests,
  type AssignmentIdStorage,
} from "../assignmentId";
import { OnboardingStudioClient } from "../OnboardingStudioClient";
import { createOnboardingStudio } from "../OnboardingStudio";
import type { UserPropertyStore } from "../userProperties/store";

const KEY = ASSIGNMENT_ID_STORAGE_KEY;

/** Storage whose every call can be held open, to interleave operations. */
const controllableStorage = (initial: Record<string, string> = {}) => {
  const data: Record<string, string> = { ...initial };
  const held: Array<() => void> = [];
  let holding = false;
  const maybeHold = () =>
    holding ? new Promise<void>((resolve) => held.push(resolve)) : Promise.resolve();
  const storage = {
    getItem: vi.fn(async (k: string): Promise<string | null> => {
      const v = data[k] ?? null; // read at call time, like a real store
      await maybeHold();
      return v;
    }),
    setItem: vi.fn(async (k: string, v: string) => {
      await maybeHold();
      data[k] = v;
    }),
    removeItem: vi.fn(async (k: string) => {
      await maybeHold();
      delete data[k];
    }),
  } satisfies AssignmentIdStorage;
  return {
    data,
    storage,
    hold: () => {
      holding = true;
    },
    /** Stop holding and let every held call through, in order. */
    releaseAll: async () => {
      holding = false;
      while (held.length) held.shift()!();
      for (let i = 0; i < 20; i++) await Promise.resolve();
    },
  };
};

let n = 0;
const counter = () => `generated-${++n}`;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("installation id store: clear()", () => {
  it("removes the stored id, and the next get mints and persists a different one", async () => {
    const s = controllableStorage();
    const store = createInstallationIdStore(s.storage, counter);
    const first = await store.get();
    expect(s.data[KEY]).toBe(first);

    await store.clear();
    expect(s.data[KEY]).toBeUndefined();

    const second = await store.get();
    expect(second).toMatch(/^generated-/);
    expect(second).not.toBe(first);
    expect(s.data[KEY]).toBe(second);
  });

  it("running during an in-flight FIRST-LAUNCH load does not resurrect the id", async () => {
    const s = controllableStorage();
    const store = createInstallationIdStore(s.storage, counter);
    s.hold(); // getItem → null is held, then generate + setItem would follow
    const inFlight = store.get();
    const cleared = store.clear();
    await s.releaseAll();
    await cleared;

    // The request that was in flight must not send an id that no longer exists…
    expect(await inFlight).toBeUndefined();
    // …and the id it generated must not be on disk afterwards.
    expect(s.data[KEY]).toBeUndefined();
  });

  it("running while the first-launch WRITE is in flight does not resurrect the id", async () => {
    const s = controllableStorage();
    const store = createInstallationIdStore(s.storage, counter);
    const inFlight = store.get();
    // Let getItem resolve, then hold the setItem that follows.
    await Promise.resolve();
    s.hold();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const cleared = store.clear();
    await s.releaseAll();
    await cleared;

    expect(await inFlight).toBeUndefined();
    expect(s.data[KEY]).toBeUndefined();
  });

  it("a removal that the platform would finish BEFORE an earlier, slow write still wins", async () => {
    // AsyncStorage does not promise ordering between calls, so a removeItem
    // issued after a setItem may complete first. Here the write is slow and the
    // removal instant: without ordering, the write lands last and the id is back.
    const data: Record<string, string> = {};
    let finishWrite!: () => void;
    const storage = {
      getItem: vi.fn(async (k: string) => data[k] ?? null),
      setItem: vi.fn(
        (k: string, v: string) =>
          new Promise<void>((resolve) => {
            finishWrite = () => {
              data[k] = v;
              resolve();
            };
          }),
      ),
      removeItem: vi.fn(async (k: string) => {
        delete data[k];
      }),
    } satisfies AssignmentIdStorage;
    const store = createInstallationIdStore(storage, counter);
    const inFlight = store.get();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(storage.setItem).toHaveBeenCalledTimes(1); // the write is in flight
    const cleared = store.clear();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    finishWrite();
    await cleared;
    expect(await inFlight).toBeUndefined();
    expect(data[KEY]).toBeUndefined();
  });

  it("running during an in-flight read of an existing id: that request sends nothing, disk is empty", async () => {
    const s = controllableStorage({ [KEY]: "existing" });
    const store = createInstallationIdStore(s.storage, counter);
    s.hold();
    const inFlight = store.get();
    const cleared = store.clear();
    await s.releaseAll();
    await cleared;
    expect(await inFlight).toBeUndefined();
    expect(s.data[KEY]).toBeUndefined();
  });

  it("a get started after clear, while the old load is still writing, keeps ITS id on disk", async () => {
    const s = controllableStorage();
    const store = createInstallationIdStore(s.storage, counter);
    s.hold();
    const old = store.get();
    const cleared = store.clear();
    const fresh = store.get();
    await s.releaseAll();
    await cleared;

    expect(await old).toBeUndefined();
    const id = await fresh;
    expect(id).toMatch(/^generated-/);
    expect(s.data[KEY]).toBe(id);
  });

  it("rejects when the removal fails, and the store still works afterwards", async () => {
    const s = controllableStorage({ [KEY]: "existing" });
    const store = createInstallationIdStore(s.storage, counter);
    expect(await store.get()).toBe("existing");
    s.storage.removeItem.mockRejectedValueOnce(new Error("disk"));
    await expect(store.clear()).rejects.toThrow("disk");
    // The memo was reset: the next get reads disk again.
    expect(await store.get()).toBe("existing");
    expect(s.storage.getItem).toHaveBeenCalledTimes(2);
  });
});

describe("clear() against a request whose host getter is still pending", () => {
  it("a consent getter pending across clear() does not mint, persist or send an id", async () => {
    vi.useFakeTimers();
    try {
      const s = controllableStorage();
      const store = createInstallationIdStore(s.storage, counter);
      let consented = true;
      // Async consent check: answers `null` ("no host id") 50ms later.
      const getter = () => new Promise<null>((r) => setTimeout(() => r(null), 50));

      const request = resolveAssignmentId(getter, store);
      await vi.advanceTimersByTimeAsync(10);
      consented = false; // consent withdrawn while the request is in flight
      await store.clear();
      await vi.advanceTimersByTimeAsync(100);

      expect(consented).toBe(false);
      expect(await request).toBeUndefined();
      expect(s.storage.setItem).not.toHaveBeenCalled();
      expect(s.data[KEY]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a request that starts after clear() still mints normally", async () => {
    const s = controllableStorage();
    const store = createInstallationIdStore(s.storage, counter);
    await store.clear();
    const id = await resolveAssignmentId(async () => null, store);
    expect(id).toMatch(/^generated-/);
    expect(s.data[KEY]).toBe(id);
  });
});

describe("a storage call slower than the bound", () => {
  /** A storage call that settles after `ms` (fake timers), running `effect` then. */
  const slow =
    <T>(ms: number, effect: () => T) =>
    () =>
      new Promise<T>((resolve) => setTimeout(() => resolve(effect()), ms));

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("getItem takes 2.5s: get() omits at 2s, and the abandoned load never mints or writes", async () => {
    const s = controllableStorage();
    s.storage.getItem.mockImplementationOnce(slow(2500, () => null));
    const generate = vi.fn(counter);
    const store = createInstallationIdStore(s.storage, generate);

    const first = store.get();
    const firstAt = settleTime(first);
    await vi.advanceTimersByTimeAsync(STORAGE_OP_TIMEOUT_MS);
    expect(await first).toBeUndefined();
    expect(await firstAt).toBe(STORAGE_OP_TIMEOUT_MS);

    // The read finishes at 2.5s with "no id": the abandoned load must stop there.
    await vi.advanceTimersByTimeAsync(1000);
    expect(generate).not.toHaveBeenCalled();
    expect(s.storage.setItem).not.toHaveBeenCalled();
    expect(s.data[KEY]).toBeUndefined();

    // A later request is not affected.
    const later = store.get();
    await vi.advanceTimersByTimeAsync(10);
    expect(await later).toMatch(/^generated-/);
  });

  it("a getItem that never settles does not hold the queue: the next get() mints at once", async () => {
    const s = controllableStorage();
    s.storage.getItem.mockImplementationOnce(() => new Promise<never>(() => {}));
    const store = createInstallationIdStore(s.storage, counter);

    const first = store.get();
    await vi.advanceTimersByTimeAsync(STORAGE_OP_TIMEOUT_MS);
    expect(await first).toBeUndefined();

    const next = store.get();
    const nextAt = settleTime(next);
    await vi.advanceTimersByTimeAsync(10);
    const id = await next;
    expect(id).toMatch(/^generated-/);
    expect(await nextAt).toBeLessThan(10); // did not wait behind the hung read
    expect(s.data[KEY]).toBe(id);
  });

  it("a setItem that never settles keeps holding the queue: later get() calls fail closed", async () => {
    const s = controllableStorage();
    s.storage.setItem.mockImplementationOnce(() => new Promise<never>(() => {}));
    const store = createInstallationIdStore(s.storage, counter);

    const first = store.get();
    await vi.advanceTimersByTimeAsync(STORAGE_OP_TIMEOUT_MS);
    expect(await first).toBeUndefined();

    const next = store.get();
    const nextAt = settleTime(next);
    await vi.advanceTimersByTimeAsync(STORAGE_OP_TIMEOUT_MS);
    expect(await next).toBeUndefined();
    expect(await nextAt).toBe(STORAGE_OP_TIMEOUT_MS); // waited its own bound
    expect(s.storage.getItem).toHaveBeenCalledTimes(1); // never ran: queue held
  });

  it("setItem takes 2.5s: a clear() issued meanwhile removes the key AFTER the write lands", async () => {
    const s = controllableStorage();
    s.storage.setItem.mockImplementationOnce((k: string, v: string) =>
      slow(2500, () => {
        s.data[k] = v;
      })(),
    );
    const store = createInstallationIdStore(s.storage, counter);

    const request = store.get();
    await vi.advanceTimersByTimeAsync(STORAGE_OP_TIMEOUT_MS);
    expect(await request).toBeUndefined(); // the caller stopped waiting at 2s

    // The abandoned write is still in flight. The removal must queue behind it.
    await vi.advanceTimersByTimeAsync(100);
    const cleared = store.clear().catch(() => {});
    await vi.advanceTimersByTimeAsync(1000); // the write lands at 2.5s
    await cleared;
    expect(s.data[KEY]).toBeUndefined();
  });

  it("removeItem takes 5s: clear() rejects at 2s, a get() meanwhile fails closed, then things proceed", async () => {
    const s = controllableStorage({ [KEY]: "existing" });
    s.storage.removeItem.mockImplementationOnce((k: string) =>
      slow(5000, () => {
        delete s.data[k];
      })(),
    );
    const generate = vi.fn(counter);
    const store = createInstallationIdStore(s.storage, generate);

    const outcome = store.clear().then(
      () => "resolved",
      (e: Error) => e.message,
    );
    const during = store.get(); // queued behind the hung removal
    await vi.advanceTimersByTimeAsync(STORAGE_OP_TIMEOUT_MS);
    expect(await outcome).toMatch(/timed out/);
    // It did not skip ahead of the removal: it waited its own 2s and omitted.
    await vi.advanceTimersByTimeAsync(10);
    expect(await during).toBeUndefined();
    expect(s.data[KEY]).toBe("existing"); // removal still in flight

    // The removal settles at 5s; the abandoned get never mints or writes.
    await vi.advanceTimersByTimeAsync(3500);
    expect(s.data[KEY]).toBeUndefined();
    expect(generate).not.toHaveBeenCalled();

    const after = store.get();
    await vi.advanceTimersByTimeAsync(10);
    expect(await after).toMatch(/^generated-/);
    expect(s.data[KEY]).toBe(await after);
  });
});

/** Fake-clock time (ms) at which `p` settles, measured from now. */
const settleTime = (p: Promise<unknown>) => {
  const start = Date.now();
  return p.then(
    () => Date.now() - start,
    () => Date.now() - start,
  );
};

describe("clearAssignmentId() on the client and the facade", () => {
  const fakeResponse = {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ metadata: {}, steps: [], paywalls: {} }),
    headers: { get: () => null },
  };

  beforeEach(() => {
    disk.data = {};
    __resetInstallationIdForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("client.clearAssignmentId() removes the stored id; the next request sends a new one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);
    vi.stubGlobal("fetch", fetchMock);
    const client = new OnboardingStudioClient("proj-1", {});
    const sent = (i: number) =>
      new URL(fetchMock.mock.calls[i][0] as string).searchParams.get("assignmentId");

    await client.getSteps();
    const first = sent(0);
    expect(disk.data[KEY]).toBe(first);

    await client.clearAssignmentId();
    expect(disk.data[KEY]).toBeUndefined();

    await client.getPaywalls();
    expect(sent(1)).toBeTruthy();
    expect(sent(1)).not.toBe(first);
  });

  it("OnboardingStudio.clearAssignmentId() works before init and clears the process-wide id", async () => {
    disk.data[KEY] = "existing";
    const studio = createOnboardingStudio({} as UserPropertyStore);
    await studio.clearAssignmentId();
    expect(disk.data[KEY]).toBeUndefined();
  });
});
