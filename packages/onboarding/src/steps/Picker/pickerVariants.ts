/**
 * The `Picker` page's variants, and the values each one hands back.
 *
 * This module exists because the two halves had drifted: `PickerTypeEnum`
 * declared seven types while `Pages/Picker/Renderer.tsx` drew four, so `age`,
 * `gender` and `coach` fell through to a placeholder rendering the literal text
 * `Picker type "<x>" not yet implemented` on a real device, with no validation
 * error anywhere (#210). `PickerTypeEnum` is now derived from `PICKER_TYPES`
 * below, so the schema cannot declare a type this list does not carry.
 *
 * It lives in the headless package, RN-free, for two reasons: the renderer
 * cannot be mounted in this monorepo's Node test environment (so the routing
 * decision and the value contracts would otherwise be untestable), and the UI
 * package imports it directly rather than re-deriving the list — the same shape
 * as `resolveWheelPickerItems`.
 */

/**
 * Every type the `Picker` page can actually draw.
 *
 * `coach` is deliberately absent. It has no roster data source anywhere in the
 * SDK, no payload field that could carry one, and never appeared in the public
 * docs (`website/docs/page-types.mdx` lists weight/height/age/gender/name/date).
 * Implementing it means inventing a data model; it is tracked as a dependency of
 * the avatar-builder need instead of shipped as a placeholder.
 */
export const PICKER_TYPES = ["height", "weight", "age", "date", "gender", "name"] as const;

export type PickerType = (typeof PICKER_TYPES)[number];

const PICKER_TYPE_SET: ReadonlySet<string> = new Set<string>(PICKER_TYPES);

/**
 * Narrow a payload's `pickerType` to something drawable, or `null`.
 *
 * `payload.pickerType` stays `z.union([PickerTypeEnum, z.string()])`, so any
 * string validates and this is the only gate. Tightening the union instead would
 * move the failure inside the renderer's own `PickerStepTypeSchema.parse`, which
 * `withErrorBoundary` wraps — an already-published `coach` payload would lose the
 * whole screen rather than show a placeholder, which is the opposite of the
 * direction #209 set for unknown element types (omit and warn, never throw). The
 * hard refusal belongs at publish time, in Studio.
 */
export const resolvePickerType = (pickerType: string): PickerType | null =>
  PICKER_TYPE_SET.has(pickerType) ? (pickerType as PickerType) : null;

/**
 * What the renderer logs when it takes the placeholder branch.
 *
 * Pruning the enum alone changes nothing at runtime — a typo like `"gendre"`
 * still validates and still reaches the placeholder — so the unknown path has to
 * say so out loud. Not `__DEV__`-gated, for the same reason
 * `formatUnknownElementTypes` is not: this fires when a published payload is
 * ahead of, or disagrees with, the installed SDK, which is exactly what a host
 * needs in production logs.
 */
export const formatUnsupportedPickerType = (pickerType: string): string =>
  `[Picker] pickerType "${pickerType}" is not a type this SDK build can draw ` +
  `(${PICKER_TYPES.join(", ")}), so the screen is showing a placeholder instead of a picker. ` +
  `Fix the payload, or upgrade @rocapine/react-native-onboarding-ui if the type is newer ` +
  `than this build.`;

/**
 * The gender choices offered by `pickerType: "gender"`.
 *
 * `value` is what leaves through `onContinue` and is the host's key; `label` is
 * display only. Labels are English literals because this whole page is — the
 * month names and the name field's "Type to write" placeholder are too — and
 * making it translatable is a separate change across every variant.
 */
export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]["value"];

/**
 * The range `pickerType: "age"` offers.
 *
 * Fixed, not author-configurable: `PickerStepPayloadSchema` carries only
 * `title`, `description` and `pickerType`, so there is nowhere to put a range
 * without widening the payload — deliberately out of scope here.
 */
export const AGE_RANGE = { min: 13, max: 100, default: 25 } as const;

/**
 * Ages high to low, matching every other option list on this page
 * (`generateWeightOptions`, `generateCmOptions`, `generateYearOptions` all
 * descend), so the wheel reads the same way whatever the picker type.
 */
export const generateAgeOptions = (): number[] => {
  const options: number[] = [];
  for (let age = AGE_RANGE.max; age >= AGE_RANGE.min; age--) options.push(age);
  return options;
};

/**
 * `"25-years"`, following the weight picker's `"70-kg"` and the height picker's
 * `"170-cm"` — one parsing rule for every quantity this page collects.
 */
export const formatAgeValue = (age: number): string => `${age}-years`;
