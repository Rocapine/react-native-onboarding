import { describe, it, expect, vi } from "vitest";
import { createCatalogSettleWaiter } from "../catalogSettleWaiter";

// A controllable stand-in for setTimeout: records pending callbacks so a test can
// fire them deliberately instead of waiting on real time.
const makeScheduler = () => {
  const pending: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
  const schedule = (fn: () => void, ms: number) => {
    const entry = { fn, ms, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  const fire = () => {
    for (const entry of [...pending]) if (!entry.cancelled) entry.fn();
  };
  return { schedule, fire, pending };
};

describe("createCatalogSettleWaiter", () => {
  it("resolves immediately when the catalog is not loading", async () => {
    const { schedule, pending } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => false, schedule);
    await waiter.wait(1000);
    // Nothing was scheduled: there was nothing to wait for.
    expect(pending).toHaveLength(0);
  });

  it("parks while loading and resolves on settle()", async () => {
    const { schedule } = makeScheduler();
    let loading = true;
    const waiter = createCatalogSettleWaiter(() => loading, schedule);

    let resolved = false;
    const promise = waiter.wait(1000).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    loading = false;
    waiter.settle();
    await promise;
    expect(resolved).toBe(true);
  });

  it("resolves on timeout even if settle() never comes", async () => {
    const { schedule, fire } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const promise = waiter.wait(1000);
    fire();
    await expect(promise).resolves.toBeUndefined();
  });

  it("passes the requested timeout to the scheduler", async () => {
    const { schedule, pending, fire } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const promise = waiter.wait(4321);
    expect(pending[0].ms).toBe(4321);
    fire();
    await promise;
  });

  it("resolves each waiter exactly once when a timeout races a settle", async () => {
    const { schedule, fire } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const onResolve = vi.fn();
    const promise = waiter.wait(1000).then(onResolve);

    waiter.settle();
    fire(); // the timeout fires after the settle already resolved it
    await promise;

    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it("cancels a waiter's timer once it has settled, leaving nothing pending", async () => {
    const { schedule, pending } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const promise = waiter.wait(1000);
    waiter.settle();
    await promise;
    expect(pending.every((entry) => entry.cancelled)).toBe(true);
  });

  it("settles every parked waiter", async () => {
    const { schedule } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const results: number[] = [];
    const all = Promise.all([
      waiter.wait(1000).then(() => results.push(1)),
      waiter.wait(1000).then(() => results.push(2)),
      waiter.wait(1000).then(() => results.push(3)),
    ]);
    waiter.settle();
    await all;
    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it("does not skip a waiter that re-parks from another waiter's continuation", async () => {
    const { schedule } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    const second = vi.fn();

    // The first waiter's continuation parks a NEW waiter — which must not be
    // dropped by the drain that woke the first one.
    const first = waiter.wait(1000).then(() => {
      void waiter.wait(1000).then(second);
    });

    waiter.settle();
    await first;
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled(); // still parked, correctly

    waiter.settle();
    await Promise.resolve();
    await Promise.resolve();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("settle() with nothing parked is a no-op", () => {
    const { schedule } = makeScheduler();
    const waiter = createCatalogSettleWaiter(() => true, schedule);
    expect(() => waiter.settle()).not.toThrow();
  });

  it("defaults to real timers when no scheduler is injected", async () => {
    const waiter = createCatalogSettleWaiter(() => true);
    await expect(waiter.wait(1)).resolves.toBeUndefined();
  });
});
