import { describe, it, expect } from "vitest";
import {
  ButtonActionSchema,
} from "../steps/ComposableScreen/elements/ButtonElement";

describe("ButtonActionSchema", () => {
  it("still accepts the legacy arms", () => {
    expect(ButtonActionSchema.parse("continue")).toBe("continue");
    expect(
      ButtonActionSchema.parse({ type: "custom", function: "doThing" })
    ).toEqual({ type: "custom", function: "doThing" });
    expect(
      ButtonActionSchema.parse({ type: "setVariable", name: "x", value: "1" })
    ).toMatchObject({ type: "setVariable", name: "x", value: "1" });
  });

  it("accepts navigate with a stepId", () => {
    expect(ButtonActionSchema.parse({ type: "navigate", stepId: "s2" })).toEqual(
      { type: "navigate", stepId: "s2" }
    );
  });

  it("rejects navigate with an empty stepId", () => {
    expect(() =>
      ButtonActionSchema.parse({ type: "navigate", stepId: "" })
    ).toThrow();
  });

  it("accepts capability arms with declared writes", () => {
    expect(
      ButtonActionSchema.parse({
        type: "requestHealthSync",
        metrics: ["menstrualFlow"],
        writes: [{ name: "cycleStart", kind: "string" }],
      })
    ).toMatchObject({
      type: "requestHealthSync",
      writes: [{ name: "cycleStart", kind: "string" }],
    });
    expect(
      ButtonActionSchema.parse({ type: "requestNotificationPermission" })
    ).toEqual({ type: "requestNotificationPermission" });
    expect(
      ButtonActionSchema.parse({ type: "presentPaywall", placement: "main" })
    ).toMatchObject({ type: "presentPaywall", placement: "main" });
    expect(ButtonActionSchema.parse({ type: "restorePurchase" })).toEqual({
      type: "restorePurchase",
    });
    expect(ButtonActionSchema.parse({ type: "requestReview" })).toEqual({
      type: "requestReview",
    });
  });

  it("accepts openURL and rejects an empty url", () => {
    expect(
      ButtonActionSchema.parse({ type: "openURL", url: "https://x.io", external: true })
    ).toEqual({ type: "openURL", url: "https://x.io", external: true });
    expect(() => ButtonActionSchema.parse({ type: "openURL", url: "" })).toThrow();
  });

  it("rejects a writes entry with an empty name", () => {
    expect(() =>
      ButtonActionSchema.parse({
        type: "presentPaywall",
        writes: [{ name: "" }],
      })
    ).toThrow();
  });

  it("rejects an unknown action type", () => {
    expect(() =>
      ButtonActionSchema.parse({ type: "definitelyNotAnAction" })
    ).toThrow();
  });
});
