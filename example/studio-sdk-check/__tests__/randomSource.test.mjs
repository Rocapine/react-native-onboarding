// node --test: which source of randomness the tracker's run id came from.
// A valid UUIDv7 comes out of both branches of randomBytes16, so the id alone
// proves nothing: these tests count the calls to each source.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOnboardingRunTracker } from "@rocapine/studio-sdk/onboarding";
import { isLowercaseUuidV7, withRandomSource } from "../randomSource.ts";

const nodeCrypto = globalThis.crypto;
const CONTEXT = { appVersion: "1.0.0", build: "1", platform: "ios", osVersion: "18.0", locale: "en-US", timezone: "Europe/Paris" };
const startRun = () => {
  const tracker = createOnboardingRunTracker({ sink: { send: () => ({ outcome: "accepted" }) }, context: CONTEXT, onDiagnostic: () => {} });
  const run = tracker.start({ onboarding: { key: "check", version: "1" }, manifest: { steps: [{ stepKey: "a" }] } });
  tracker.dispose();
  return run.runId;
};

describe("isLowercaseUuidV7", () => {
  it("accepts a v7 id with the 10xx variant", () => {
    assert.equal(isLowercaseUuidV7("01928f3e-7b2c-7d4e-8f00-123456789abc"), true);
    assert.equal(isLowercaseUuidV7("01928f3e-7b2c-7d4e-bf00-123456789abc"), true);
  });
  it("rejects another version, another variant, upper case and junk", () => {
    assert.equal(isLowercaseUuidV7("01928f3e-7b2c-4d4e-8f00-123456789abc"), false);
    assert.equal(isLowercaseUuidV7("01928f3e-7b2c-7d4e-cf00-123456789abc"), false);
    assert.equal(isLowercaseUuidV7("01928F3E-7B2C-7D4E-8F00-123456789ABC"), false);
    assert.equal(isLowercaseUuidV7("00000000-0000-0000-0000-000000000000"), false);
    assert.equal(isLowercaseUuidV7(""), false);
  });
});

describe("withRandomSource", () => {
  it("absent: getRandomValues is gone during the call, the id comes from Math.random, and the global is restored", () => {
    const before = globalThis.crypto;
    const r = withRandomSource("absent", startRun);
    assert.equal(r.typeDuring, "undefined");
    assert.equal(r.getRandomValuesCalls, 0);
    assert.ok(r.mathRandomCalls >= 16, `Math.random called ${r.mathRandomCalls} times`);
    assert.equal(isLowercaseUuidV7(r.result), true, r.result);
    assert.equal(globalThis.crypto, before);
    assert.equal(typeof globalThis.crypto.getRandomValues, "function");
  });

  it("present: the id comes from getRandomValues and Math.random is not touched", () => {
    const r = withRandomSource("present", startRun);
    assert.equal(r.typeDuring, "function");
    assert.ok(r.getRandomValuesCalls >= 1);
    assert.equal(r.mathRandomCalls, 0);
    assert.equal(isLowercaseUuidV7(r.result), true, r.result);
  });

  it("present on a runtime without the global: uses the supplied implementation, then removes it again", () => {
    withRandomSource("absent", () => {
      const r = withRandomSource("present", startRun, (a) => nodeCrypto.getRandomValues(a));
      assert.equal(r.typeBefore, "undefined");
      assert.equal(r.typeDuring, "function");
      assert.ok(r.getRandomValuesCalls >= 1);
      assert.equal(r.mathRandomCalls, 0);
      assert.equal(typeof globalThis.crypto?.getRandomValues, "undefined");
    });
  });

  it("restores the globals when the call throws", () => {
    const random = Math.random;
    assert.throws(() => withRandomSource("absent", () => { throw new Error("boom"); }), /boom/);
    assert.equal(Math.random, random);
    assert.equal(typeof globalThis.crypto.getRandomValues, "function");
  });
});
