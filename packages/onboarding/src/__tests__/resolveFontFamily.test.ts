import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable Platform mock — isSystemFontFamily reads Platform.OS at call time.
const { Platform } = vi.hoisted(() => ({
  Platform: { OS: "android" as "ios" | "android" },
}));
vi.mock("react-native", () => ({ Platform }));

import {
  resolveFontFamily,
  isSystemFontFamily,
  type FontRegistry,
} from "../infra/fonts/registry";

describe("resolveFontFamily", () => {
  beforeEach(() => {
    Platform.OS = "android";
  });

  // Playfair Display: bold has both upright + italic faces at weight 700.
  const registry: FontRegistry = {
    "playfair-display": {
      400: { normal: "PlayfairDisplay-Regular", italic: "PlayfairDisplay-Italic" },
      700: { normal: "PlayfairDisplay-Bold", italic: "PlayfairDisplay-BoldItalic" },
    },
  };

  it("selects the italic face when fontStyle: italic is requested", () => {
    expect(resolveFontFamily(registry, "playfair-display", 700, "italic")).toBe(
      "PlayfairDisplay-BoldItalic"
    );
    expect(resolveFontFamily(registry, "playfair-display", 700, "normal")).toBe(
      "PlayfairDisplay-Bold"
    );
  });

  it("defaults to the upright face when no style is given", () => {
    expect(resolveFontFamily(registry, "playfair-display", 700)).toBe(
      "PlayfairDisplay-Bold"
    );
  });

  it("falls back to the other style when the requested one is absent at that weight", () => {
    const onlyNormal: FontRegistry = {
      fam: { 700: { normal: "Fam-Bold" } },
    };
    expect(resolveFontFamily(onlyNormal, "fam", 700, "italic")).toBe("Fam-Bold");
  });

  it("matches the nearest weight when exact weight is missing", () => {
    expect(resolveFontFamily(registry, "playfair-display", 600, "italic")).toBe(
      "PlayfairDisplay-BoldItalic"
    );
  });

  it("returns the raw family name for an unregistered family", () => {
    expect(resolveFontFamily(registry, "unknown", 400)).toBe("unknown");
  });
});

describe("system font collision (iOS)", () => {
  beforeEach(() => {
    Platform.OS = "android";
  });

  it("treats SF Pro family names as system fonts only on iOS", () => {
    Platform.OS = "ios";
    expect(isSystemFontFamily("sf-pro-display")).toBe(true);
    expect(isSystemFontFamily("SF Pro Display")).toBe(true);
    expect(isSystemFontFamily("system")).toBe(true);
    expect(isSystemFontFamily("playfair-display")).toBe(false);

    Platform.OS = "android";
    expect(isSystemFontFamily("sf-pro-display")).toBe(false);
  });

  it("resolves a system family to undefined on iOS (use the real system font)", () => {
    const registry: FontRegistry = {
      "sf-pro-display": { 500: { normal: "SFProDisplay-Medium" } },
    };
    Platform.OS = "ios";
    expect(resolveFontFamily(registry, "sf-pro-display", 500)).toBeUndefined();

    Platform.OS = "android";
    expect(resolveFontFamily(registry, "sf-pro-display", 500)).toBe(
      "SFProDisplay-Medium"
    );
  });
});
