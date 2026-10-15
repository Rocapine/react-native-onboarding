import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  defaultEnvironment,
  normalizeEnvironment,
  readNativeAppInfo,
  resolveRequestIdentity,
} from "../requestIdentity";
import { SDK_VERSION } from "../version";

describe("SDK_VERSION", () => {
  it("equals the package version", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../..", "package.json"), "utf8"));
    expect(SDK_VERSION).toBe(pkg.version);
  });
});

describe("readNativeAppInfo", () => {
  it("reads version and build from expo-application", () => {
    expect(
      readNativeAppInfo(() => ({ nativeApplicationVersion: "2.3.0", nativeBuildVersion: "45" })),
    ).toEqual({ appVersion: "2.3.0", build: "45" });
  });

  it("is empty when expo-application is not installed", () => {
    expect(readNativeAppInfo(() => null)).toEqual({});
  });

  it("is empty, without throwing, when loading expo-application throws", () => {
    expect(
      readNativeAppInfo(() => {
        throw new Error("Cannot find module 'expo-application'");
      }),
    ).toEqual({});
  });

  it("omits null and blank values (web, or an unlinked native module)", () => {
    expect(
      readNativeAppInfo(() => ({ nativeApplicationVersion: null, nativeBuildVersion: "  " })),
    ).toEqual({ appVersion: undefined, build: undefined });
  });

  it("the default loader never throws", () => {
    expect(() => readNativeAppInfo()).not.toThrow();
  });
});

describe("defaultEnvironment", () => {
  it("is sandbox in sandbox mode, whatever __DEV__ says", () => {
    expect(defaultEnvironment(true, true)).toBe("sandbox");
    expect(defaultEnvironment(true, false)).toBe("sandbox");
  });
  it("is development under __DEV__, production otherwise", () => {
    expect(defaultEnvironment(false, true)).toBe("development");
    expect(defaultEnvironment(undefined, false)).toBe("production");
  });
  it("reads __DEV__ when not told, and treats an undefined __DEV__ as production", () => {
    expect(defaultEnvironment(undefined)).toBe("production");
  });
});

describe("normalizeEnvironment", () => {
  it("lower-cases and drops characters outside [a-z0-9_-]", () => {
    expect(normalizeEnvironment("Staging Env!", "production")).toBe("stagingenv");
    expect(normalizeEnvironment("qa_2-eu", "production")).toBe("qa_2-eu");
  });
  it("caps at 32 characters", () => {
    expect(normalizeEnvironment("a".repeat(200), "production")).toBe("a".repeat(32));
  });
  it("falls back when nothing survives or the value is not a string", () => {
    expect(normalizeEnvironment("   ", "production")).toBe("production");
    expect(normalizeEnvironment("!!!", "sandbox")).toBe("sandbox");
    expect(normalizeEnvironment(undefined, "development")).toBe("development");
    expect(normalizeEnvironment(42, "production")).toBe("production");
  });
});

describe("resolveRequestIdentity", () => {
  const native = { appVersion: "2.3.0", build: "45" };

  it("host values win over expo-application", () => {
    expect(resolveRequestIdentity({ appVersion: "9.9.9", build: "1" }, native, false)).toEqual({
      appVersion: "9.9.9",
      build: "1",
      sdkVersion: SDK_VERSION,
      environment: "production",
    });
  });

  it("expo-application fills what the host left out, and a blank host value counts as left out", () => {
    expect(resolveRequestIdentity({ appVersion: " " }, native, false)).toEqual({
      appVersion: "2.3.0",
      build: "45",
      sdkVersion: SDK_VERSION,
      environment: "production",
    });
  });

  it("omits appVersion and build when neither source has them", () => {
    expect(resolveRequestIdentity({}, {}, false)).toEqual({
      sdkVersion: SDK_VERSION,
      environment: "production",
    });
  });

  it("normalizes a host environment and defaults from the mode", () => {
    expect(resolveRequestIdentity({ environment: "Staging" }, {}, false).environment).toBe("staging");
    expect(resolveRequestIdentity({ isSandbox: true }, {}, false).environment).toBe("sandbox");
    expect(resolveRequestIdentity({}, {}, true).environment).toBe("development");
  });
});
