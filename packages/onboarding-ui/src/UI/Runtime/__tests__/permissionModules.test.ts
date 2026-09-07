import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_KINDS } from "../elements/actions";
import type { PermissionKind } from "../elements/actions";
import {
  PERMISSION_MODULES,
  permissionModuleLoaders,
  requestPermissionViaExpoModules,
} from "../elements/permissions";

/**
 * The bundled Expo resolver behind `requestPermission` (#196), and the one
 * property of it that no unit test could see: whether the seven optional peer
 * deps are **optional to Metro**.
 *
 * Review round 1 caught this the hard way — the example app stopped bundling on
 * every platform with `Unable to resolve module expo-notifications`, because a
 * `require()` is only marked optional by Metro when the call sits DIRECTLY
 * inside a literal `try` block. Metro's own rule
 * (`isOptionalDependency`, `@expo/metro-config/build/transform-worker/collect-dependencies.js`)
 * walks at most three statements up from the call and returns true only when
 * the first `BlockStatement` it meets is a `TryStatement`'s own `block`. A
 * `require` inside an arrow function that a try/catch HELPER later invokes is
 * therefore mandatory: Metro must resolve the string at graph-build time,
 * before any of that code runs, and the whole app fails to bundle.
 *
 * So the shape of these calls is load-bearing, not stylistic, and it is checked
 * at source level — nothing observable at runtime in Node distinguishes the two
 * forms, which is exactly why the first version shipped green.
 */

const PERMISSIONS_SRC = join(__dirname, "../elements/permissions.ts");
const source = readFileSync(PERMISSIONS_SRC, "utf8");

/**
 * Trimmed source lines with blanks and comments dropped, original order kept.
 * Comments are dropped because this file DISCUSSES the shape it must not use —
 * a scan that reads prose finds a `require(candidate.module)` that is not code.
 */
const isComment = (text: string) =>
  text.startsWith("//") || text.startsWith("*") || text.startsWith("/*");

const codeLines = source
  .split("\n")
  .map((line, index) => ({ index, text: line.trim() }))
  .filter((line) => line.text.length > 0 && !isComment(line.text));

const code = codeLines.map((line) => line.text).join("\n");

describe("permissions.ts — Metro optional-dependency shape", () => {
  it("requires every module from directly inside a literal try block", () => {
    const requireLines = codeLines.filter((line) => /(^|[^.\w])require\(/.test(line.text));
    expect(requireLines.length).toBeGreaterThan(0);

    for (const line of requireLines) {
      // One statement deep, so Metro's three-statement walk reaches the try.
      expect(line.text).toMatch(/^return require\("[^"]+"\);$/);
      const previous = codeLines[codeLines.indexOf(line) - 1];
      expect(previous?.text, `require on line ${line.index + 1} is not inside a try block`).toBe(
        "try {"
      );
    }
  });

  it("requires only string literals — Metro cannot resolve a computed specifier", () => {
    const requires = [...code.matchAll(/require\(([^)]*)\)/g)].map((m) => m[1]);
    expect(requires.length).toBeGreaterThan(0);
    for (const arg of requires) expect(arg).toMatch(/^"[^"]+"$/);
  });
});

describe("PERMISSION_MODULES", () => {
  // Guards the whole table being wrong or empty: without this, replacing it
  // with `{}` keeps every test green, because a Node/vitest run resolves
  // nothing either way and answers "unavailable" for a correct table and a
  // broken one alike.
  it("covers every declared kind with a loadable module and a function name", () => {
    for (const kind of PERMISSION_KINDS) {
      const candidates = PERMISSION_MODULES[kind];
      expect(candidates?.length, `no module declared for "${kind}"`).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(candidate.fns.length, `no function named for ${candidate.module}`).toBeGreaterThan(0);
        for (const fn of candidate.fns) expect(fn).toMatch(/^request[A-Za-z]*Async$/);
        expect(
          typeof permissionModuleLoaders[candidate.module],
          `no loader for "${candidate.module}"`
        ).toBe("function");
      }
    }
  });

  it("declares no loader that no kind asks for", () => {
    const referenced = new Set(
      PERMISSION_KINDS.flatMap((kind) => PERMISSION_MODULES[kind].map((c) => c.module))
    );
    expect([...Object.keys(permissionModuleLoaders)].sort()).toEqual([...referenced].sort());
  });

  /**
   * Pinned deliberately. The function names were read off the Expo docs for
   * each module, NOT off an installed package — none of the seven is installed
   * in this monorepo, and installing them to test would defeat the point of
   * their being optional. So this is a change-detector: it cannot prove a name
   * is right, but it stops one being silently edited or fat-fingered, which is
   * the failure mode that would report a real GRANT as a refusal on a device.
   */
  it("pins the module and function names", () => {
    expect(
      Object.fromEntries(
        PERMISSION_KINDS.map((kind) => [
          kind,
          PERMISSION_MODULES[kind].map((c) => `${c.module}#${c.fns.join("|")}`),
        ])
      )
    ).toEqual({
      notifications: ["expo-notifications#requestPermissionsAsync"],
      appTrackingTransparency: ["expo-tracking-transparency#requestTrackingPermissionsAsync"],
      locationWhenInUse: ["expo-location#requestForegroundPermissionsAsync"],
      camera: ["expo-camera#requestCameraPermissionsAsync"],
      microphone: [
        "expo-audio#requestRecordingPermissionsAsync",
        "expo-camera#requestMicrophonePermissionsAsync",
      ],
      photoLibrary: [
        "expo-image-picker#requestMediaLibraryPermissionsAsync",
        "expo-media-library#requestPermissionsAsync",
      ],
    });
  });
});

describe("requestPermissionViaExpoModules — against an injected module loader", () => {
  const stub = (modules: Record<string, unknown>) => {
    const loadModule = vi.fn((name: string) => modules[name] ?? null);
    return { loadModule, loadModule2: loadModule };
  };

  const ask = (kind: PermissionKind, modules: Record<string, unknown>) =>
    requestPermissionViaExpoModules(kind, { loadModule: (name) => modules[name] ?? null });

  it("calls the declared function and reads its response", async () => {
    const requestPermissionsAsync = vi.fn().mockResolvedValue({ status: "granted", granted: true });
    await expect(ask("notifications", { "expo-notifications": { requestPermissionsAsync } })).resolves.toBe(
      "granted"
    );
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("reports a refusal as denied, never as granted", async () => {
    await expect(
      ask("camera", {
        "expo-camera": { requestCameraPermissionsAsync: async () => ({ status: "denied", granted: false }) },
      })
    ).resolves.toBe("denied");
  });

  // The two-candidate kinds. `expo-audio` is the current microphone module but
  // `expo-camera` is the more commonly installed of the two in a video app, so
  // the fallback is a real path, not padding.
  it("falls through to the second candidate when the first module is absent", async () => {
    const requestMicrophonePermissionsAsync = vi
      .fn()
      .mockResolvedValue({ status: "granted", granted: true });
    await expect(
      ask("microphone", { "expo-camera": { requestMicrophonePermissionsAsync } })
    ).resolves.toBe("granted");
    expect(requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("falls through when the first module is present but lacks the function", async () => {
    const requestPermissionsAsync = vi.fn().mockResolvedValue({ status: "granted" });
    await expect(
      ask("photoLibrary", {
        "expo-image-picker": { somethingElse: 1 },
        "expo-media-library": { requestPermissionsAsync },
      })
    ).resolves.toBe("granted");
  });

  it("answers unavailable when no candidate module is installed", async () => {
    await expect(ask("locationWhenInUse", {})).resolves.toBe("unavailable");
  });

  it("answers unavailable when the native call rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      ask("appTrackingTransparency", {
        "expo-tracking-transparency": {
          requestTrackingPermissionsAsync: async () => {
            throw new Error("no ATT on this device");
          },
        },
      })
    ).resolves.toBe("unavailable");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("answers unavailable when a loader itself throws", async () => {
    await expect(
      requestPermissionViaExpoModules("notifications", {
        loadModule: () => {
          throw new Error("resolution failed");
        },
      })
    ).resolves.toBe("unavailable");
  });

  // The injected path must not poison — or read — the module cache the default
  // path keeps, or one test's stub would decide another app's answer.
  it("does not share its result with the default cached resolver", async () => {
    await expect(
      ask("notifications", {
        "expo-notifications": { requestPermissionsAsync: async () => ({ status: "granted" }) },
      })
    ).resolves.toBe("granted");
    await expect(requestPermissionViaExpoModules("notifications")).resolves.toBe("unavailable");
  });
});

describe("public type surface", () => {
  // A host implementing the documented HealthKit / Screen Time escape hatch has
  // to be able to name the resolver's type. Source-level because these are
  // types: nothing about them is observable at runtime.
  it("re-exports the resolver types from the package root", () => {
    const index = readFileSync(join(__dirname, "../../../index.ts"), "utf8");
    expect(index).toContain("PermissionResolver");
    expect(index).toContain("PermissionOutcome");
    expect(index).toContain("PermissionKind");
  });
});
