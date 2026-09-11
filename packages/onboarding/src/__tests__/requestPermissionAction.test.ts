import { describe, it, expect } from "vitest";
import {
  ButtonActionSchema,
  PERMISSION_KINDS,
  PermissionKindSchema,
} from "../steps/common.types";
import { UIElementSchema } from "../screens/types";

/**
 * The headless half of the `requestPermission` ButtonAction (#196).
 *
 * The headless schema is what validates a published payload, so a variant that
 * exists only in the UI mirror still throws `invalid_union` on parse — the
 * failure mode CLAUDE.md's step 3 warns about. These tests pin the headless
 * side: the eighth union member, its closed `kind` enum, and the fact that its
 * three outcome hooks recurse through `ButtonActionSchema` the way
 * `purchase`/`restore` do.
 */

describe("PermissionKind", () => {
  // Deliberately narrow: every kind here must be reachable through an
  // optionally-installed Expo module the SDK can dynamic-`require` at press
  // time. HealthKit and Screen Time / Family Controls need app-owned
  // entitlements and a config plugin neither package ships, so they are NOT
  // members — they arrive later behind the host `requestPermission` resolver.
  it("is exactly the six kinds an Expo module can request", () => {
    expect([...PERMISSION_KINDS]).toEqual([
      "notifications",
      "appTrackingTransparency",
      "locationWhenInUse",
      "camera",
      "microphone",
      "photoLibrary",
    ]);
  });

  it("rejects a kind outside the enum", () => {
    expect(PermissionKindSchema.safeParse("healthkit").success).toBe(false);
    expect(PermissionKindSchema.safeParse("notification").success).toBe(false);
  });
});

describe("ButtonActionSchema — requestPermission", () => {
  it("accepts the minimal action (kind only)", () => {
    const parsed = ButtonActionSchema.safeParse({
      type: "requestPermission",
      kind: "notifications",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts all three outcome hooks as nested ButtonAction lists", () => {
    const parsed = ButtonActionSchema.safeParse({
      type: "requestPermission",
      kind: "notifications",
      onGranted: [{ type: "setVariable", name: "push", value: "on" }, "continue"],
      onDenied: ["continue"],
      onUnavailable: [{ type: "dismiss" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a requestPermission nested inside another action's hook", () => {
    // Recursion through the same union is what makes ask-then-ask possible, and
    // is the property `purchase.onSuccess` already relies on.
    const parsed = ButtonActionSchema.safeParse({
      type: "purchase",
      product: "yearly",
      onSuccess: [{ type: "requestPermission", kind: "notifications", onGranted: ["continue"] }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing kind", () => {
    expect(
      ButtonActionSchema.safeParse({ type: "requestPermission" }).success
    ).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(
      ButtonActionSchema.safeParse({ type: "requestPermission", kind: "healthkit" }).success
    ).toBe(false);
  });

  it("rejects a non-array outcome hook", () => {
    expect(
      ButtonActionSchema.safeParse({
        type: "requestPermission",
        kind: "camera",
        onGranted: "continue",
      }).success
    ).toBe(false);
  });

  it("rejects a garbage action inside an outcome hook", () => {
    expect(
      ButtonActionSchema.safeParse({
        type: "requestPermission",
        kind: "camera",
        onGranted: [{ type: "notAnAction" }],
      }).success
    ).toBe(false);
  });
});

describe("UIElement round-trip", () => {
  it("parses a Button whose actions request a permission", () => {
    const parsed = UIElementSchema.safeParse({
      id: "cta",
      type: "Button",
      props: {
        label: "Enable notifications",
        actions: [
          {
            type: "requestPermission",
            kind: "notifications",
            onGranted: ["continue"],
            onDenied: ["continue"],
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("parses a generic onPress that requests a permission", () => {
    const parsed = UIElementSchema.safeParse({
      id: "card",
      type: "YStack",
      props: {
        onPress: [{ type: "requestPermission", kind: "photoLibrary", onGranted: ["continue"] }],
      },
      children: [],
    });
    expect(parsed.success).toBe(true);
  });
});
