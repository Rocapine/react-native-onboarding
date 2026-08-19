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
  it("initial mount before settle: HOLDS HIDDEN, does not play", () => {
    // The entrance must not burn under the host's push transition — and the
    // element must not be VISIBLE while it waits, or there is no entrance left
    // to see when the hold releases.
    expect(decideEnteringPlay(false, false)).toEqual({
      phase: "hold",
      playEntering: false,
      hidden: true,
      keySuffix: "hold",
    });
  });

  it("releases the deferred play once the screen settles, via a key change", () => {
    const held = decideEnteringPlay(false, false);
    const released = decideEnteringPlay(false, true);
    expect(released.playEntering).toBe(true);
    expect(released.hidden).toBe(false);
    // The key MUST change, or the already-mounted wrapper never re-runs
    // `entering` — reanimated only fires it on mount.
    expect(released.keySuffix).not.toBe(held.keySuffix);
  });

  it("arriving later, screen already settled: plays immediately on mount", () => {
    expect(decideEnteringPlay(false, true)).toEqual({
      phase: "play",
      playEntering: true,
      hidden: false,
      keySuffix: "play",
    });
  });

  it("revisiting after it has played: VISIBLE, never plays again", () => {
    for (const settled of [true, false]) {
      expect(decideEnteringPlay(true, settled)).toEqual({
        phase: "done",
        playEntering: false,
        hidden: false,
        keySuffix: "done",
      });
    }
  });

  it("REGRESSION: hold and done must differ in OUTPUT, not merely in intent", () => {
    // The shipped 1.65.0 bug. Both states correctly declined to play, and a
    // boolean return collapsed them — so a held element rendered at full
    // opacity (no entrance visible), then blinked to 0 and re-faded on release.
    // The decision table was right; the return type could not express the
    // difference. Assert the two are distinguishable in what they produce.
    const hold = decideEnteringPlay(false, false);
    const done = decideEnteringPlay(true, true);

    expect(hold.playEntering).toBe(done.playEntering); // both decline to play...
    expect(hold.hidden).not.toBe(done.hidden); // ...but must NOT render alike
    expect(hold.keySuffix).not.toBe(done.keySuffix);
  });

  it("a played element's key is stable, so it never remounts on settle", () => {
    expect(decideEnteringPlay(true, false).keySuffix).toBe(decideEnteringPlay(true, true).keySuffix);
  });

  it("full lifecycle: hidden hold -> play -> latch -> visible and silent on revisit", () => {
    const latch = createEnteringLatch();
    const id = "prop-1";

    let playedAtMount = latch.hasPlayed(id);
    const held = decideEnteringPlay(playedAtMount, false);
    expect(held).toMatchObject({ phase: "hold", hidden: true, playEntering: false });

    const released = decideEnteringPlay(playedAtMount, true);
    expect(released).toMatchObject({ phase: "play", hidden: false, playEntering: true });
    latch.markPlayed(id);

    // swipe away and back: fresh mount re-samples the latch
    playedAtMount = latch.hasPlayed(id);
    expect(playedAtMount).toBe(true);
    expect(decideEnteringPlay(playedAtMount, true)).toMatchObject({
      phase: "done",
      hidden: false,
      playEntering: false,
    });
  });

  it("a mid-flight re-render cannot cancel a running animation", () => {
    // The decision is derived from the value sampled AT MOUNT, not from a live
    // read. `markPlayed` runs while the animation is in flight; re-deriving from
    // a live `hasPlayed` would flip play->done, change the key, remount and cut
    // the animation off.
    const latch = createEnteringLatch();
    const playedAtMount = latch.hasPlayed("x"); // false, sampled once
    const first = decideEnteringPlay(playedAtMount, true);
    latch.markPlayed("x"); // animation now running, latch marked

    expect(decideEnteringPlay(playedAtMount, true)).toEqual(first);
    // whereas a live read would have produced the destructive flip:
    expect(decideEnteringPlay(latch.hasPlayed("x"), true).keySuffix).not.toBe(first.keySuffix);
  });
});

describe("the settle signal's honest scope", () => {
  it("DEFAULT_ENTERING_SETTLE_MS approximates a push transition, not a decode wait", async () => {
    // Regression guard on a real trap. `InteractionManager.runAfterInteractions`
    // fails in two OPPOSITE ways, so "is it stubbed in my version?" is not a
    // route back to it:
    //   • RN 0.85+ — stubbed: a bare setImmediate, `createInteractionHandle()`
    //     returns -1. Fires on the next tick and defers nothing.
    //   • earlier, implemented — its queue reportedly does not drain while
    //     react-native-screens push transitions are active, so it fires late or
    //     never. That is the default navigator for a native stack.
    // RN's Image also never registered an interaction handle, so it would not
    // have covered decode either way. Hence a host-overridable duration.
    const { DEFAULT_ENTERING_SETTLE_MS } = await import("../elements/EnteringLatchContext");
    expect(DEFAULT_ENTERING_SETTLE_MS).toBeGreaterThan(16); // must outlast a frame
    expect(DEFAULT_ENTERING_SETTLE_MS).toBeLessThanOrEqual(1000); // must not read as broken
  });
});
