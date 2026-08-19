import { describe, it, expect } from "vitest";
import { createEnteringLatch, decideEnteringPlay } from "../elements/enteringLatch";

describe("createEnteringLatch", () => {
  it("records per element id and is independent per latch (per screen)", () => {
    const a = createEnteringLatch();
    const b = createEnteringLatch();
    expect(a.hasPlayed("hero")).toBe(false);
    a.markPlayed("hero");
    expect(a.hasPlayed("hero")).toBe(true);
    expect(a.hasPlayed("other")).toBe(false);
    // A second screen starts clean — "once per screen lifetime", not per app.
    expect(b.hasPlayed("hero")).toBe(false);
  });

  it("marking twice is idempotent", () => {
    const l = createEnteringLatch();
    l.markPlayed("x");
    l.markPlayed("x");
    expect(l.hasPlayed("x")).toBe(true);
  });
});

describe("decideEnteringPlay — the whole `once` contract", () => {
  it("initial mount before settle: holds, does not play", () => {
    // Bug 1: the entrance would otherwise burn during the host's push
    // transition, before remote images have decoded.
    expect(decideEnteringPlay(false, false)).toEqual({ play: false, keySuffix: "hold" });
  });

  it("releases the deferred play once the screen settles, via a key change", () => {
    const held = decideEnteringPlay(false, false);
    const released = decideEnteringPlay(false, true);
    expect(released.play).toBe(true);
    // The key MUST change, or the already-mounted wrapper never re-runs
    // `entering` — reanimated only fires it on mount.
    expect(released.keySuffix).not.toBe(held.keySuffix);
  });

  it("arriving later, screen already settled: plays immediately on mount", () => {
    expect(decideEnteringPlay(false, true)).toEqual({ play: true, keySuffix: "play" });
  });

  it("revisiting after it has played: never plays again, settled or not", () => {
    // Bug 2: swiping back to a carousel slide re-mounts its gated decorations.
    expect(decideEnteringPlay(true, true)).toEqual({ play: false, keySuffix: "hold" });
    expect(decideEnteringPlay(true, false)).toEqual({ play: false, keySuffix: "hold" });
  });

  it("a played element's key is stable, so it never remounts on settle", () => {
    expect(decideEnteringPlay(true, false).keySuffix).toBe(decideEnteringPlay(true, true).keySuffix);
  });

  it("full lifecycle: defer -> play -> latch -> silent on every revisit", () => {
    const latch = createEnteringLatch();
    const id = "prop-1";

    // mount 1, screen still arriving
    let playedAtMount = latch.hasPlayed(id);
    expect(decideEnteringPlay(playedAtMount, false).play).toBe(false);

    // screen settles -> released, and the play marks the latch
    const released = decideEnteringPlay(playedAtMount, true);
    expect(released.play).toBe(true);
    latch.markPlayed(id);

    // swipe away and back: fresh mount re-samples the latch
    playedAtMount = latch.hasPlayed(id);
    expect(playedAtMount).toBe(true);
    expect(decideEnteringPlay(playedAtMount, true).play).toBe(false);

    // and again
    expect(decideEnteringPlay(latch.hasPlayed(id), true).play).toBe(false);
  });

  it("a mid-flight re-render cannot cancel a running animation", () => {
    // The decision is derived from the value sampled AT MOUNT, not from a live
    // read. `markPlayed` runs while the animation is in flight; if the component
    // re-renders for any unrelated reason, re-deriving from a live `hasPlayed`
    // would flip play->hold, change the key, remount and cut the animation off.
    const latch = createEnteringLatch();
    const playedAtMount = latch.hasPlayed("x"); // false, sampled once
    const first = decideEnteringPlay(playedAtMount, true);
    latch.markPlayed("x"); // animation now running, latch marked

    const afterUnrelatedRerender = decideEnteringPlay(playedAtMount, true);
    expect(afterUnrelatedRerender).toEqual(first);

    // whereas a live read would have produced the destructive flip:
    expect(decideEnteringPlay(latch.hasPlayed("x"), true).keySuffix).not.toBe(first.keySuffix);
  });
});
