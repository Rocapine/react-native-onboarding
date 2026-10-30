import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  COMPOSABLE_SCREEN_DEPRECATION_WARNING,
  createDeprecationWarner,
} from "../deprecationWarning";

/**
 * The `ComposableScreen` STEP type is deprecated (#353); its element engine is
 * not, because paywalls render through the same `ScreenRenderer`. So the dev
 * warning belongs to the step adapter alone, and a paywall must never emit it.
 *
 * The behaviour half is the warner itself. The placement half is source-level,
 * like `hostResolverWiring.test.ts`: which files call it is a property of the
 * tree, and a second caller in shared code would warn on every paywall without
 * failing any behaviour test that only mounts a ComposableScreen step.
 * `ComposableScreenRenderer.deprecation.test.ts` mounts both surfaces.
 */

describe("createDeprecationWarner", () => {
  it("warns once, with the deprecation message, however often it is called", () => {
    const warn = vi.fn();
    const warnOnce = createDeprecationWarner(() => true, warn);
    warnOnce();
    warnOnce();
    warnOnce();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(COMPOSABLE_SCREEN_DEPRECATION_WARNING);
  });

  it("never warns outside a dev build", () => {
    const warn = vi.fn();
    const warnOnce = createDeprecationWarner(() => false, warn);
    warnOnce();
    warnOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it("names the step type and every built-in alternative", () => {
    expect(COMPOSABLE_SCREEN_DEPRECATION_WARNING).toMatch(/ComposableScreen.*deprecated/);
    for (const type of ["MediaContent", "Question", "Picker", "Carousel", "Loader", "Ratings", "Commitment", "Paywall"]) {
      expect(COMPOSABLE_SCREEN_DEPRECATION_WARNING).toContain(type);
    }
  });
});

describe("warnComposableScreenDeprecated — reads __DEV__", () => {
  const g = globalThis as { __DEV__?: boolean };

  afterEach(() => {
    delete g.__DEV__;
    vi.restoreAllMocks();
  });

  /** A fresh module, so each case starts with the once-latch unset. */
  const fresh = async () => {
    vi.resetModules();
    return (await import("../deprecationWarning")).warnComposableScreenDeprecated;
  };

  it("warns once under __DEV__", async () => {
    g.__DEV__ = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const warnOnce = await fresh();
    warnOnce();
    warnOnce();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(COMPOSABLE_SCREEN_DEPRECATION_WARNING);
  });

  it("is silent when __DEV__ is false", async () => {
    g.__DEV__ = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    (await fresh())();
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent when __DEV__ is undefined", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    (await fresh())();
    expect(warn).not.toHaveBeenCalled();
  });
});

const SRC = join(__dirname, "../../../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** Every non-test source file under `src` whose text matches `pattern`. */
const filesMatching = (pattern: RegExp): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (pattern.test(readFileSync(full, "utf8"))) out.push(relative(SRC, full));
    }
  };
  walk(SRC);
  return out.sort();
};

describe("deprecation warning — placement", () => {
  it("is called from the ComposableScreen step adapter and nowhere else", () => {
    expect(filesMatching(/warnComposableScreenDeprecated\s*\(/)).toEqual([
      "UI/Pages/ComposableScreen/Renderer.tsx",
    ]);
    expect(filesMatching(/from\s+["'][^"']*deprecationWarning["']/)).toEqual([
      "UI/Pages/ComposableScreen/Renderer.tsx",
    ]);
  });

  it("is called from an effect inside the renderer, never at module scope", () => {
    // `src/index.ts` star-exports `UI/Pages`, so this module loads in every app,
    // paywall-only ones included. A module-scope call would warn in all of them.
    const source = read("UI/Pages/ComposableScreen/Renderer.tsx");
    const body = source.slice(
      source.indexOf("const ComposableScreenRendererBase"),
      source.indexOf("export const ComposableScreenRenderer")
    );
    expect(body).toMatch(/useEffect\(\(\) => \{\s*warnComposableScreenDeprecated\(\);\s*\}, \[\]\);/);
    expect(source.split("warnComposableScreenDeprecated();").length - 1).toBe(1);
  });

  it("is reached only through OnboardingPage's ComposableScreen case", () => {
    expect(filesMatching(/<ComposableScreenRenderer\b/)).toEqual(["UI/OnboardingPage.tsx"]);
    const page = read("UI/OnboardingPage.tsx");
    const tag = page.indexOf("<ComposableScreenRenderer");
    expect(page.slice(page.lastIndexOf("case ", tag), tag)).toMatch(/^case 'ComposableScreen':/);
  });

  it("is not imported by any paywall, runtime or template module", () => {
    // The paywall render path: `PaywallHost` and the `Paywall` step both render
    // through `ScreenRenderer` inside `OnboardingTemplate`.
    const shared = filesMatching(/./).filter((f) =>
      /^UI\/(Paywall|Pages\/Paywall|Runtime|Templates)\//.test(f)
    );
    expect(shared.length).toBeGreaterThan(10);
    for (const file of shared) {
      const source = read(file);
      expect(source, `${file} imports the ComposableScreen step adapter`).not.toMatch(
        /from\s+["'][^"']*ComposableScreen[^"']*["']/
      );
      expect(source, `${file} names ComposableScreenRenderer outside a comment`).not.toMatch(
        /^[^*/]*\bComposableScreenRenderer\b/m
      );
      expect(source, `${file} calls the deprecation warning`).not.toMatch(/warnComposableScreenDeprecated/);
    }
  });
});
