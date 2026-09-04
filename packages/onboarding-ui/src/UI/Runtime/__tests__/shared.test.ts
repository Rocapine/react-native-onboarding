import { describe, it, expect } from "vitest";
import { interpolate, interpolateIdentifier } from "../elements/shared";

describe("interpolate", () => {
  it("prefers label over value when both are set", () => {
    expect(interpolate("{{plan}}", { plan: { value: "yearly", label: "Yearly" } })).toBe("Yearly");
  });

  it("falls back to value when there is no label", () => {
    expect(interpolate("{{plan}}", { plan: { value: "yearly" } })).toBe("yearly");
  });

  it("resolves an unknown key to an empty string", () => {
    expect(interpolate("{{missing}}", {})).toBe("");
  });

  it("substitutes multiple placeholders in one template", () => {
    const vars = {
      a: { value: "1", label: "One" },
      b: { value: "2" },
    };
    expect(interpolate("{{a}} and {{b}}", vars)).toBe("One and 2");
  });
});

describe("interpolateIdentifier", () => {
  it("trims a spaced reference, exactly as interpolate does", () => {
    // These two must agree: `purchase.product` resolves through this one, so a
    // paywall authored `product: "{{ plan }}"` used to resolve to an empty slot
    // key and buy nothing, while the same reference rendered fine in a Text.
    const vars = { plan: { value: "yearly", label: "Yearly" } };
    expect(interpolateIdentifier("{{ plan }}", vars)).toBe("yearly");
    expect(interpolate("{{ plan }}", vars)).toBe("Yearly");
    expect(interpolateIdentifier("https://cdn/{{ plan }}.png", vars)).toBe(
      "https://cdn/yearly.png"
    );
  });

  // The inverse of `interpolate` — this is the whole point of the helper.
  // A RadioGroup item's `value` ("yearly") and `label` ("Yearly") commonly
  // differ; a `purchase` action resolving `{{plan}}` needs the machine
  // identifier (value), not the display label.
  it("prefers value over label when both are set", () => {
    expect(interpolateIdentifier("{{plan}}", { plan: { value: "yearly", label: "Yearly" } })).toBe("yearly");
  });

  it("falls back to label when there is no value", () => {
    const vars = { plan: { value: undefined as unknown as string, label: "Yearly" } };
    expect(interpolateIdentifier("{{plan}}", vars)).toBe("Yearly");
  });

  it("resolves an unknown key to an empty string", () => {
    expect(interpolateIdentifier("{{missing}}", {})).toBe("");
  });

  it("passes through a literal (non-{{}}) string unchanged", () => {
    expect(interpolateIdentifier("yearly", {})).toBe("yearly");
  });
});
