import { describe, it, expect } from "vitest";
import { z } from "zod";
import { deriveElementTypeNames, getKnownElementTypes } from "../screens/elementTypeRegistry";
import { UIElementSchema } from "../screens/types";

/**
 * The type-name derivation is schema-AGNOSTIC on purpose (#209, review
 * finding 2).
 *
 * The strip decides what renders, and what renders is the onboarding-ui
 * package's own re-declared `UIElementSchema` — a different file, in a package
 * joined to this one by a peer-dependency RANGE, so the two versions can
 * legitimately differ in a host app. That package therefore has to derive its
 * OWN capability set with this same mechanism instead of inheriting this
 * package's answer, and these tests pin the mechanism it depends on: give it a
 * union it has never seen, get that union's literals back.
 */

const variant = (type: string) =>
  z.object({ id: z.string(), type: z.literal(type), props: z.object({}) });

describe("deriveElementTypeNames", () => {
  it("reads the literals of a discriminated union it has never seen", () => {
    const schema = z.discriminatedUnion("type", [variant("Halo"), variant("Sparkle")]);
    expect([...deriveElementTypeNames(schema)].sort()).toEqual(["Halo", "Sparkle"]);
  });

  it("looks through a z.lazy wrapper, as both packages' real schemas use one", () => {
    const schema = z.lazy(() => z.discriminatedUnion("type", [variant("Halo")]));
    expect([...deriveElementTypeNames(schema)]).toEqual(["Halo"]);
  });

  it("answers with an empty set — never a partial one — for a schema it cannot read", () => {
    // Empty is the agreed "could not tell" signal every caller reads as "learn
    // nothing". Anything else here would be read as a capability list.
    expect(deriveElementTypeNames(z.string()).size).toBe(0);
    expect(deriveElementTypeNames(undefined).size).toBe(0);
    expect(deriveElementTypeNames({ _zod: { def: "nonsense" } }).size).toBe(0);
  });

  it("agrees with getKnownElementTypes on this package's own schema", () => {
    // The cached, no-argument accessor must be the same derivation applied to
    // the headless union — otherwise "known" would mean two different things.
    expect([...getKnownElementTypes()].sort()).toEqual(
      [...deriveElementTypeNames(UIElementSchema)].sort()
    );
  });
});
