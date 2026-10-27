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
  createInstallationIdStore,
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
    getItem: vi.fn(async (k: string) => {
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
