import { describe, it, expect } from "vitest";
import {
  PICKER_TYPES,
  resolvePickerType,
  formatUnsupportedPickerType,
  GENDER_OPTIONS,
  AGE_RANGE,
  generateAgeOptions,
  formatAgeValue,
} from "../steps/Picker/pickerVariants";
import { PickerTypeEnum, PickerStepTypeSchema } from "../steps/Picker/types";

/**
 * The headless half of #210. `PickerTypeEnum` declared seven types while
 * `Pages/Picker/Renderer.tsx` drew four, so `age`, `gender` and `coach` reached
 * a placeholder printing `Picker type "<x>" not yet implemented` on a real
 * device — a schema-without-a-renderer mismatch that no validation error ever
 * reported.
 *
 * Everything the renderer needs to make that decision (which types exist, what
 * options they offer, what value they hand back) lives here rather than inside
 * the renderer, because the renderer cannot be mounted in this monorepo's Node
 * test environment. What can only be asserted in the UI package — that the
 * renderer actually dispatches on each of these — is covered by
 * `packages/onboarding-ui/src/UI/Pages/Picker/__tests__/pickerVariants.test.ts`.
 */

const step = (pickerType: string) => ({
  id: "p1",
  name: "Picker",
  type: "Picker" as const,
  displayProgressHeader: true,
  customPayload: {},
  figmaUrl: null,
  payload: { title: "t", description: null, pickerType },
});

describe("the picker-type list is the list the SDK can draw", () => {
  it("does not declare `coach` — there is no roster data source anywhere in the SDK", () => {
    // Removed rather than implemented: `coach` has no data source, no props to
    // carry a roster, and is absent from the public docs
    // (`website/docs/page-types.mdx` lists weight/height/age/gender/name/date).
    // Tracked as a dependency of the avatar-builder need instead.
    expect(PICKER_TYPES).not.toContain("coach");
  });

  it("declares exactly the six documented types", () => {
    expect([...PICKER_TYPES].sort()).toEqual([
      "age",
      "date",
      "gender",
      "height",
      "name",
      "weight",
    ]);
  });

  it("derives PickerTypeEnum from that list, so the two cannot drift", () => {
    // The defect was a hand-maintained enum that outgrew the renderer. One list.
    expect(PickerTypeEnum.options).toEqual([...PICKER_TYPES]);
  });
});

describe("an unrecognised pickerType still parses, and is resolved to nothing", () => {
  // `pickerType: z.union([PickerTypeEnum, z.string()])` stays. Tightening it to
  // the enum would move the failure inside the renderer's own `.parse` — which
  // `withErrorBoundary` wraps — so an already-published `coach` payload would
  // lose the WHOLE screen instead of showing a placeholder. That cuts against
  // the direction #209 set for unknown element types (omit and warn, never
  // throw). The hard block belongs at publish time, in Studio.
  it.each(["coach", "gendre", "Gender", "", "TimeOfDay"])(
    "parses a payload with pickerType %o",
    (pickerType) => {
      expect(() => PickerStepTypeSchema.parse(step(pickerType))).not.toThrow();
    }
  );

  it.each(["coach", "gendre", "Gender", "", "TimeOfDay"])(
    "resolves %o to null so the renderer takes the placeholder branch",
    (pickerType) => {
      expect(resolvePickerType(pickerType)).toBeNull();
    }
  );

  it.each([...PICKER_TYPES])("resolves the known type %o to itself", (pickerType) => {
    expect(resolvePickerType(pickerType)).toBe(pickerType);
  });

  it("names the offending type and the supported set in its diagnostic", () => {
    // Pruning the enum alone changes nothing at runtime — any string validates —
    // so the unknown path has to be loud. This message is what the renderer logs.
    const message = formatUnsupportedPickerType("gendre");
    expect(message).toContain('"gendre"');
    for (const type of PICKER_TYPES) expect(message).toContain(type);
  });
});

describe("gender options", () => {
  it("offers a stable, non-empty set of values", () => {
    expect(GENDER_OPTIONS.map((o) => o.value)).toEqual([
      "female",
      "male",
      "other",
      "prefer_not_to_say",
    ]);
  });

  it("gives every option a label", () => {
    for (const option of GENDER_OPTIONS) expect(option.label.trim().length).toBeGreaterThan(0);
  });

  it("keeps values distinct from labels, so hosts key on the value", () => {
    // The value is what leaves via `onContinue`; the label is display only and
    // will change when this page becomes translatable.
    const values = GENDER_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const option of GENDER_OPTIONS) expect(option.value).not.toBe(option.label);
  });
});

describe("age options", () => {
  it("spans the declared range", () => {
    const options = generateAgeOptions();
    expect(options).toHaveLength(AGE_RANGE.max - AGE_RANGE.min + 1);
    expect(options).toContain(AGE_RANGE.min);
    expect(options).toContain(AGE_RANGE.max);
  });

  it("runs high to low, like every other option list on this page", () => {
    // `generateWeightOptions`, `generateCmOptions` and `generateYearOptions` all
    // descend, so the wheel reads the same way across picker types.
    const options = generateAgeOptions();
    expect(options).toEqual([...options].sort((a, b) => b - a));
  });

  it("defaults to an age inside the range", () => {
    expect(generateAgeOptions()).toContain(AGE_RANGE.default);
  });

  it('hands the value back in the existing "<value>-<unit>" shape', () => {
    // The weight picker returns "70-kg" and the height picker "170-cm"
    // (`Pages/Picker/Renderer.tsx`), so an age is "25-years" rather than a bare
    // number — one parsing rule for every quantity this page collects.
    expect(formatAgeValue(25)).toBe("25-years");
    expect(formatAgeValue(AGE_RANGE.max)).toBe(`${AGE_RANGE.max}-years`);
  });
});
