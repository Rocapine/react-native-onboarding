// node --test: the guard that keeps this example off any production endpoint.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLocalUrl, collectorUrlFor, CHECK_STORAGE_KEY } from "../localOnly.ts";

describe("assertLocalUrl", () => {
  for (const url of [
    "http://localhost:4319/v1/onboarding-runs",
    "http://127.0.0.1:4319/v1/onboarding-runs",
    "http://10.0.2.2:4319/v1/onboarding-runs",
    "https://localhost/x",
  ]) {
    it(`accepts ${url}`, () => {
      assert.equal(assertLocalUrl(url), url);
    });
  }

  for (const url of [
    "https://api.rocalytics.com/v1/onboarding-runs",
    "http://localhost.evil.com/x",
    "http://127.0.0.1.nip.io/x",
    "http://evil.com/?h=localhost",
    "http://user@evil.com:80@localhost/x",
    "http://10.0.2.20/x",
    "http://[::1]:4319/x",
    "ftp://localhost/x",
    "not a url",
    "",
  ]) {
    it(`throws on ${JSON.stringify(url)}`, () => {
      assert.throws(() => assertLocalUrl(url), /studio-sdk check: refusing/);
    });
  }
});

describe("collectorUrlFor", () => {
  it("defaults iOS to the host loopback", () => {
    assert.equal(collectorUrlFor("ios"), "http://127.0.0.1:4319/v1/onboarding-runs");
  });
  it("defaults Android to the emulator's alias for the host loopback", () => {
    assert.equal(collectorUrlFor("android"), "http://10.0.2.2:4319/v1/onboarding-runs");
  });
  it("takes a local override", () => {
    assert.equal(collectorUrlFor("ios", "http://localhost:9999/x"), "http://localhost:9999/x");
  });
  it("throws at configuration on a non-local override", () => {
    assert.throws(() => collectorUrlFor("ios", "https://ingest.example.com/v1/onboarding-runs"), /refusing/);
  });
});

describe("CHECK_STORAGE_KEY", () => {
  it("is not the tracker's default key", () => {
    assert.notEqual(CHECK_STORAGE_KEY, "studio-sdk:onboarding-run");
    assert.match(CHECK_STORAGE_KEY, /^example:/);
  });
});
