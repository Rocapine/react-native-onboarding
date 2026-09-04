import type { ComposableVariableEntry, ComposableVariableKind } from "@rocapine/react-native-onboarding";
// Type-only import of the DatePicker prop type so the `format()` option table
// below is checked against the ONE Intl subset this SDK already defines
// (`screens/elements/DatePickerElement.ts` -> mirrored in `./DatePickerElement`).
// `import type` is erased at build time, so this pulls no React Native code
// into the headless-testable module.
import type { DatePickerElementProps } from "../types";
import { interpolate } from "./shared";

type Token =
  | { kind: "num"; value: number; isInt: boolean }
  | { kind: "str"; value: string }
  | { kind: "var"; name: string }
  // `glued` records that the NEXT character in the source was `(`, with no
  // whitespace between. The token stream itself is whitespace-free, so without
  // this flag `"Goals ({{n}})"` and `"Goals({{n}})"` are indistinguishable —
  // and only the second is plausibly a function call. `isCallAttempt` is the
  // only reader; the parser stays whitespace-insensitive, so `list ({{x}})`
  // still evaluates.
  | { kind: "ident"; name: string; glued: boolean }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "eof" };

type Value =
  // `missing: true` marks the numeric-0 default an *absent* variable resolves to.
  // Arithmetic ignores the flag (every result is a fresh object), but the list
  // helpers read it so `count({{never_answered}})` is 0 rather than a hard fail.
  // `missing` marks a value that IS an absent variable; `unseeded` marks one
  // DERIVED from an absent variable, because arithmetic mints a fresh number
  // and the flag has to survive it — `addDays({{d}}, {{weeks}} * 7)` with
  // `weeks` unset was returning the start date unchanged, silently, which is
  // the form the parser's own JSDoc advertises. Two fields rather than one:
  // `asList` keys on `missing` so `count({{skipped}})` is still 0, while
  // `count({{gone}} + 1)` stays a hard failure rather than becoming 0.
  | { kind: "number"; n: number; isInt: boolean; missing?: boolean; unseeded?: boolean }
  // `label` is the variable entry's display label, when it had one. Only the
  // list helpers read it, so `list({{plan}})` reads "Quarterly" the way
  // `interpolate` does rather than "quarterly_14d". `valueToString` — and so
  // string concat, and `asDate` — deliberately ignore it and keep using the
  // machine value, which is also what makes a `DatePicker` variable (ISO in
  // `value`, formatted text in `label`) still parseable as a date.
  | { kind: "string"; s: string; label?: string }
  // A multi-select variable (the JSON-encoded `string[]` CheckboxGroup writes).
  // `items` are the member LABELS when available (matching `interpolate`'s
  // label-first display precedence); `raw` is the original JSON string so
  // `valueToString` — and therefore string concat — is byte-identical to the
  // behaviour before this Value kind existed. `labelSplitFailed` records that
  // labels EXISTED but could not be split back onto the values, so `items` are
  // machine keys — see `asList`, which is where that gets reported.
  | { kind: "list"; items: string[]; raw: string; labelSplitFailed?: boolean };

const isDigit = (c: string) => c >= "0" && c <= "9";
const isSpace = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";
const isIdentStart = (c: string) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$";
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c);

// Decode the JSON-encoded `string[]` shape used for multi-select variables.
// Anything else (a number, an object, a mixed array) is not a member list.
function decodeStringArray(raw: string): string[] | null {
  const t = raw.trim();
  if (!t.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((x) => typeof x === "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

// True when the string parses as a JSON array or object — structured data that
// `decodeStringArray` has already refused. `"[1,2,3]"` is a mis-shaped member
// list, never a scalar answer, so the list helpers must fail loudly on it
// rather than report a believable `count()` of 1. A value that merely LOOKS
// bracketed but is not JSON (`"[not json]"` typed into an Input) is still a
// scalar and still counts as one member.
function isJsonContainer(raw: string): boolean {
  const t = raw.trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(t);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (isSpace(c)) {
      i++;
      continue;
    }
    if (c === "{" && input[i + 1] === "{") {
      const end = input.indexOf("}}", i + 2);
      if (end === -1) return null;
      const name = input.slice(i + 2, end).trim();
      if (!name) return null;
      tokens.push({ kind: "var", name });
      i = end + 2;
      continue;
    }
    if (c === "(") { tokens.push({ kind: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rparen" }); i++; continue; }
    if (c === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    if (c === '"' || c === "'") {
      // String literal. No escape sequences on purpose: the only strings the
      // stdlib takes are format specs, separators, conjunctions and plural
      // forms, none of which need a quote inside them.
      const end = input.indexOf(c, i + 1);
      if (end === -1) return null;
      tokens.push({ kind: "str", value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i;
      while (j < input.length && isIdentPart(input[j])) j++;
      tokens.push({ kind: "ident", name: input.slice(i, j), glued: input[j] === "(" });
      i = j;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ kind: "op", op: c });
      i++;
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(input[i + 1] ?? ""))) {
      let j = i;
      let dot = false;
      while (j < input.length && (isDigit(input[j]) || input[j] === ".")) {
        if (input[j] === ".") {
          if (dot) return null;
          dot = true;
        }
        j++;
      }
      const num = parseFloat(input.slice(i, j));
      if (!Number.isFinite(num)) return null;
      tokens.push({ kind: "num", value: num, isInt: !dot });
      i = j;
      continue;
    }
    return null;
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

function resolveVar(name: string, vars: Record<string, ComposableVariableEntry>): Value {
  const entry = vars[name];
  // Missing variable in arithmetic context defaults to numeric 0 so increment
  // / decrement patterns work on first click before the variable is seeded.
  if (!entry) return { kind: "number", n: 0, isInt: true, missing: true, unseeded: true };
  const raw = entry.value;
  const k = entry.kind;
  if (k === "string") return { kind: "string", s: raw, label: entry.label };
  if (k === "int") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n)
      ? { kind: "number", n, isInt: true }
      : { kind: "string", s: raw, label: entry.label };
  }
  if (k === "float") {
    const n = parseFloat(raw);
    return Number.isFinite(n)
      ? { kind: "number", n, isInt: false }
      : { kind: "string", s: raw, label: entry.label };
  }
  // No kind tag — infer from string content. A JSON `string[]` is how
  // CheckboxGroup (and `setVariable arrayOp`) store a multi-select, and neither
  // writes a `kind`, so an untagged entry is the only place a member list can
  // appear. An explicitly `kind: "string"` entry is taken at its word.
  const items = decodeStringArray(raw);
  if (items) {
    // CheckboxGroup's invariant: `label` is the ", "-joined member labels, one
    // per value. Trust it only when the arity matches — a member label that
    // itself contains ", " would split wrong, and then the raw values are the
    // safer source.
    const labels = entry.label ? entry.label.split(", ") : undefined;
    const usable = labels != null && labels.length === items.length;
    return {
      kind: "list",
      items: usable ? (labels as string[]) : items,
      raw,
      // Only a MISMATCH is a problem. No label at all is the documented
      // raw-values case (nothing better exists), and stays silent.
      labelSplitFailed: labels != null && !usable,
    };
  }
  const trimmed = raw.trim();
  if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (Number.isFinite(n)) return { kind: "number", n, isInt: Number.isInteger(n) && !trimmed.includes(".") };
  }
  return { kind: "string", s: raw, label: entry.label };
}

function valueToString(v: Value): string {
  if (v.kind === "string") return v.s;
  // A list stringifies to its ORIGINAL JSON, not to a joined label list, so
  // concatenating a multi-select variable behaves exactly as it did before the
  // list Value kind existed. Use `join()` / `list()` to get prose.
  if (v.kind === "list") return v.raw;
  if (v.isInt) return Math.trunc(v.n).toString();
  return v.n.toString();
}

// ---------------------------------------------------------------------------
// Function stdlib
//
// Every function below is reachable from exactly one place: a `setVariable`
// action with `valueMode: "expression"` (`runActions.ts`). Actions only run
// from a press handler, so the whole stdlib is PRESS-TIME. There is no
// mount/render hook, and `Text mode: "expression"` resolves `{{var}}` through
// plain `interpolate` rather than through this engine — so a headline that
// needs a computed date or an assembled sentence must have it written into a
// variable by the previous screen's Continue press, then simply interpolated.
// ---------------------------------------------------------------------------

// The `format()` spec vocabulary IS the DatePicker `format` prop's vocabulary —
// deliberately not a second date-format language (no `YYYY-MM-DD` tokens).
// The mapped type over `Required<...>` makes this exhaustive: if the SDK's Intl
// subset gains a key, this object stops compiling until the key is listed here.
// (`hour12` is the one boolean, so its "values" are the two boolean literals.)
type DateFormatSubset = NonNullable<DatePickerElementProps["format"]>;
const FORMAT_OPTION_VALUES: {
  [K in keyof Required<DateFormatSubset>]: readonly string[];
} = {
  weekday: ["long", "short", "narrow"],
  year: ["numeric", "2-digit"],
  month: ["numeric", "2-digit", "long", "short", "narrow"],
  day: ["numeric", "2-digit"],
  hour: ["numeric", "2-digit"],
  minute: ["numeric", "2-digit"],
  second: ["numeric", "2-digit"],
  hour12: ["true", "false"],
  hourCycle: ["h11", "h12", "h23", "h24"],
  dateStyle: ["full", "long", "medium", "short"],
  timeStyle: ["full", "long", "medium", "short"],
};
const STYLE_SHORTHANDS = FORMAT_OPTION_VALUES.dateStyle;
const DAY_MS = 24 * 60 * 60 * 1000;
// The widest instant a JS Date can represent (ECMA-262 time clip). `Date.parse`
// already clips to it — it returns NaN past the maximum — so only arithmetic
// can produce an out-of-range instant.
const MAX_DATE_MS = 8.64e15;

/**
 * Parse a `format()` spec string into Intl options.
 *
 * Two accepted shapes:
 * - a bare `dateStyle` name — `"medium"` means `{ dateStyle: "medium" }`
 * - a comma-separated `key:value` list whose keys are Intl option names —
 *   `"weekday:long, month:short, day:numeric"`
 *
 * An unknown key or an out-of-enum value returns null (a hard failure) rather
 * than being dropped, so a typo cannot silently render the wrong date.
 */
function parseFormatSpec(spec: string): Intl.DateTimeFormatOptions | null {
  const trimmed = spec.trim();
  if (trimmed === "") return null;
  if ((STYLE_SHORTHANDS as readonly string[]).includes(trimmed)) {
    return { dateStyle: trimmed as DateFormatSubset["dateStyle"] };
  }
  const out: Record<string, string | boolean> = {};
  for (const part of trimmed.split(",")) {
    const piece = part.trim();
    if (piece === "") return null;
    const colon = piece.indexOf(":");
    if (colon === -1) return null;
    const key = piece.slice(0, colon).trim();
    const value = piece.slice(colon + 1).trim();
    if (!Object.prototype.hasOwnProperty.call(FORMAT_OPTION_VALUES, key)) return null;
    const allowed = FORMAT_OPTION_VALUES[key as keyof DateFormatSubset];
    if (!allowed.includes(value)) return null;
    if (key in out) return null;
    out[key] = key === "hour12" ? value === "true" : value;
  }
  // `hour12` and `hourCycle` only MODIFY how an hour is rendered; on their own
  // they select nothing, and `toLocaleString` then falls back to its full
  // date+time default. That is not what an author asking for `"hour12:true"`
  // expects to get back, and it is the one spec shape the single-call design
  // below does not cover, so reject it rather than answer with everything.
  const MODIFIERS = ["hour12", "hourCycle"];
  if (Object.keys(out).every((k) => MODIFIERS.includes(k))) return null;
  return out as Intl.DateTimeFormatOptions;
}

// Coercions. Each returns null when the value is the wrong shape, which the
// caller turns into a whole-expression hard failure.
const asNumber = (v: Value): { n: number; isInt: boolean } | null =>
  v.kind === "number" ? { n: v.n, isInt: v.isInt } : null;

/**
 * True for the numeric-0 an ABSENT variable resolves to (`resolveVar`'s
 * `missing` sentinel).
 *
 * That sentinel is right for DATA — it is what makes increment-before-seed
 * arithmetic and `count()` on a screen the user skipped work — but a bound or a
 * digit count is CONFIGURATION, and an unseeded one means the author referenced
 * a variable that does not exist. Answering from the sentinel there turns a
 * typo into a plausible constant with no warning:
 * `clamp({{score}}, {{floor}}, {{ceiling}})` reported 0 for a score of 42
 * (because `0 > 0` is false, so the range check passed),
 * `clamp({{score}}, {{floor}}, 3)` reported 3, and
 * `round(42.75, {{digits}})` reported 43.
 */
const isUnseeded = (v: Value): boolean =>
  v.kind === "number" && (v.missing === true || v.unseeded === true);

/**
 * Resolve a value to a Date. Accepts the `"now"` sentinel — the same literal
 * DatePicker already accepts for `defaultValue`/`minimumDate`/`maximumDate` —
 * or anything `Date.parse` understands (DatePicker stores `toISOString()`).
 */
function asDate(v: Value): Date | null {
  if (v.kind !== "string") return null;
  const raw = v.s.trim();
  if (raw === "now") return new Date();
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

function asList(v: Value): string[] | null {
  if (v.kind === "list") {
    if (v.labelSplitFailed) {
      // The members have display labels, but `label` is their ", "-joined form
      // and one of them contains ", " too, so the split is ambiguous and
      // `items` fell back to the machine values. Those are about to appear in
      // user-facing prose, which is exactly the believable-but-wrong output
      // this module refuses to emit silently — so say so. Not a hard failure:
      // the raw values are the only information left, and an empty sentence is
      // worse for the end user than an unpolished one.
      console.warn(
        `[ComposableScreen] setVariable expression: a multi-select variable's label ` +
          `(${JSON.stringify(v.raw)}) could not be split back onto its members, so the ` +
          "list helpers used the raw values. A member label containing \", \" causes " +
          "this; rename the option so its label has no comma-space in it."
      );
    }
    return v.items;
  }
  // An unset variable resolves to numeric 0; treat it as an empty selection so
  // `count()` / `list()` on a screen the user skipped are 0 and "".
  // A variable that holds a real NUMBER is not a list at all — `count({{age}})`
  // is a type error the author should see, not a 1 — so it fails the call.
  if (v.kind === "number") return v.missing ? [] : null;
  const decoded = decodeStringArray(v.s);
  if (decoded) return decoded;
  // Structured data of the wrong shape. This can be end-user input as much as
  // an authoring mistake — someone pasting `[1,2,3]` into an `Input` reaches it
  // — and the author will not see the console warning in production. Failing
  // still beats the alternative: answering a believable `count()` of 1 for a
  // value that plainly holds three things. Only JSON that PARSES is refused, so
  // free text that merely looks bracketed (`"[not json]"`) is still one member.
  if (isJsonContainer(v.s)) return null;
  // One member, displayed the way every other display path shows it: the label
  // when there is one, matching `interpolate`'s label-first precedence.
  return v.s.trim() === "" ? [] : [v.label ?? v.s];
}

/** "A", "A and B", "A, B and C" — no Oxford comma. */
function grammaticalList(items: string[], conjunction: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const head = items.slice(0, -1);
  const tail = items[items.length - 1];
  return `${head.join(", ")} ${conjunction} ${tail}`;
}

/**
 * Every name the stdlib answers to.
 *
 * Load-bearing TWICE, on purpose: `callFunction` refuses anything absent from
 * it, and `isCallAttempt` uses it to tell a real call from prose. Keeping one
 * set for both means it cannot drift silently — a `case` added to the switch
 * below without a matching entry here is not callable at all, which its own
 * tests catch immediately, instead of the drift showing up much later as prose
 * classification for a function that does exist.
 */
export const STDLIB_NAMES: ReadonlySet<string> = new Set([
  "min",
  "max",
  "abs",
  "round",
  "clamp",
  "addDays",
  "format",
  "list",
  "join",
  "count",
  "plural",
]);

function callFunction(name: string, args: Value[]): Value | null {
  if (!STDLIB_NAMES.has(name)) return null;
  switch (name) {
    // --- numeric -----------------------------------------------------------
    case "min":
    case "max": {
      if (args.length < 1) return null;
      const nums = args.map(asNumber);
      if (nums.some((x) => x === null)) return null;
      const vals = (nums as { n: number; isInt: boolean }[]);
      const n = name === "min"
        ? Math.min(...vals.map((x) => x.n))
        : Math.max(...vals.map((x) => x.n));
      return { kind: "number", n, isInt: vals.every((x) => x.isInt) };
    }
    case "abs": {
      if (args.length !== 1) return null;
      const a = asNumber(args[0]);
      if (!a) return null;
      return { kind: "number", n: Math.abs(a.n), isInt: a.isInt };
    }
    case "round": {
      if (args.length !== 1 && args.length !== 2) return null;
      const a = asNumber(args[0]);
      if (!a) return null;
      let digits = 0;
      if (args.length === 2) {
        // A digit count is configuration, not data.
        if (isUnseeded(args[1])) return null;
        const d = asNumber(args[1]);
        if (!d || !Number.isInteger(d.n) || d.n < 0 || d.n > 15) return null;
        digits = d.n;
      }
      if (digits === 0) return { kind: "number", n: Math.round(a.n), isInt: true };
      const f = Math.pow(10, digits);
      const n = Math.round(a.n * f) / f;
      if (!Number.isFinite(n)) return null;
      return { kind: "number", n, isInt: false };
    }
    case "clamp": {
      if (args.length !== 3) return null;
      // Bounds are configuration; the value being clamped is data, so an
      // unseeded counter still clamps to its floor.
      if (isUnseeded(args[1]) || isUnseeded(args[2])) return null;
      const [v, lo, hi] = args.map(asNumber);
      if (!v || !lo || !hi) return null;
      if (lo.n > hi.n) return null;
      return {
        kind: "number",
        n: Math.min(Math.max(v.n, lo.n), hi.n),
        isInt: v.isInt && lo.isInt && hi.isInt,
      };
    }

    // --- dates -------------------------------------------------------------
    case "addDays": {
      if (args.length !== 2) return null;
      const d = asDate(args[0]);
      // A day count is configuration, like a bound or a digit count: an
      // unseeded `{{trialDays}}` used to return the start date unchanged and
      // read as "your trial ends today", silently. See `isUnseeded`.
      if (isUnseeded(args[1])) return null;
      const n = asNumber(args[1]);
      if (!d || !n) return null;
      // A "day" here is exactly 24h of wall-clock-agnostic time, applied to the
      // UTC instant DatePicker stores. Crossing a DST boundary therefore shifts
      // the local time-of-day by an hour; use `format()` for display and don't
      // rely on the time component.
      const t = d.getTime() + n.n * DAY_MS;
      // `Number.isFinite` is not enough: every t inside ±1.8e308 is finite, but
      // past ±8.64e15 ms `new Date(t)` is an Invalid Date and `toISOString()`
      // THROWS. That exception would escape into the press handler that ran the
      // action — the same hazard `format`'s try/catch below exists for — and a
      // Continue button carrying it would die silently. A units mistake is
      // enough to reach it: `addDays("now", 90 * 365 * 24 * 60 * 60)`.
      if (!Number.isFinite(t) || Math.abs(t) > MAX_DATE_MS) return null;
      return { kind: "string", s: new Date(t).toISOString() };
    }
    case "format": {
      if (args.length !== 2 && args.length !== 3) return null;
      const d = asDate(args[0]);
      if (!d) return null;
      if (args[1].kind !== "string") return null;
      const opts = parseFormatSpec(args[1].s);
      if (!opts) return null;
      let locale: string | undefined;
      if (args.length === 3) {
        if (args[2].kind !== "string" || args[2].s.trim() === "") return null;
        locale = args[2].s.trim();
      }
      try {
        // One call for every spec shape: `toLocaleString` with only date
        // components returns only the date, and with only time components only
        // the time — verified against Node's ICU — so there is no `mode` to
        // guess the way the DatePicker renderer has to.
        return { kind: "string", s: d.toLocaleString(locale, opts) };
      } catch {
        // Intl throws when dateStyle/timeStyle is mixed with component fields.
        return null;
      }
    }

    // --- listing and grammar ----------------------------------------------
    case "list": {
      if (args.length !== 1 && args.length !== 2) return null;
      const items = asList(args[0]);
      if (!items) return null;
      let conjunction = "and";
      if (args.length === 2) {
        if (args[1].kind !== "string") return null;
        conjunction = args[1].s;
      }
      return { kind: "string", s: grammaticalList(items, conjunction) };
    }
    case "join": {
      if (args.length !== 1 && args.length !== 2) return null;
      const items = asList(args[0]);
      if (!items) return null;
      // Defaults to the ", " that CheckboxGroup hardcodes when it writes a
      // multi-select `label`, so `join(x)` reproduces today's string exactly.
      let separator = ", ";
      if (args.length === 2) {
        if (args[1].kind !== "string") return null;
        separator = args[1].s;
      }
      return { kind: "string", s: items.join(separator) };
    }
    case "count": {
      if (args.length !== 1) return null;
      const items = asList(args[0]);
      if (!items) return null;
      return { kind: "number", n: items.length, isInt: true };
    }
    case "plural": {
      if (args.length !== 3) return null;
      const n = asNumber(args[0]);
      if (!n) return null;
      if (args[1].kind !== "string" || args[2].kind !== "string") return null;
      // Two-form selection only (Intl's `one` / `other` categories). Languages
      // with `few`/`many` need Intl.PluralRules and a locale argument.
      return { kind: "string", s: Math.abs(n.n) === 1 ? args[1].s : args[2].s };
    }
    default:
      return null;
  }
}

/**
 * True when the template is an ATTEMPT at a stdlib call, so a parse failure has
 * to be reported loudly rather than papered over by interpolating the broken
 * source text into a user-visible variable.
 *
 * A "call site" is an identifier followed by `(` whose parentheses hold no bare
 * word. That last clause is what separates `"{{n}} min(s) left"` from
 * `"list({{goals}}) and more"`, which are otherwise the same shape — a known
 * name at a call site, bare words in the template. A bare identifier is never a
 * legal ARGUMENT in this grammar (arguments are numbers, strings, `{{vars}}` and
 * nested calls), so a bare word between the parentheses proves the parentheses
 * are punctuation and the name is a word: `min(s)` is an abbreviation of
 * "minutes", not a two-argument minimum. Outside the parentheses it proves
 * nothing about the call.
 *
 * Then two signals, strongest first:
 *
 * 1. A call site carrying a name the stdlib actually HAS (`STDLIB_NAMES`) is a
 *    call attempt, whatever else the template contains. This is what makes
 *    `"list({{goals}}) and more"` fail loudly: `and` / `more` are bare words,
 *    yet the author plainly meant the `list` call, and interpolating instead
 *    would write the evaluator's own source text — `"list(Sleep, Energy,
 *    Focus) and more"` — into a variable a headline then displays. This grammar
 *    has no implicit concatenation, so trailing prose needs `+ "…"`.
 * 2. Otherwise, an UNKNOWN name GLUED to its `(` is a probable misspelling of a
 *    stdlib name — but only when no bare word appears anywhere, because a bare
 *    word is the signature of prose. `"addDay({{d}}, 1)"` still fails loudly on
 *    the typo; `"{{n}} day(s)"` — the English optional-plural idiom, and the
 *    most common shape of prose with a parenthesis in it — is prose twice over,
 *    by the bare `s` inside the parens and by the bare `s` in the template.
 *
 * Whitespace is why signal 2 tests `glued` rather than just adjacency in the
 * stream. The tokenizer discards spaces, so `"Goals ({{n}})"` and
 * `"Goals({{n}})"` produce the identical stream; treating both as calls blanked
 * a whole family of ordinary copy (`"Save (50)"`, `"Basic ({{price}})"`) that no
 * previous revision of this file broke.
 *
 * A template that does not even tokenize (`"{{p}} EUR(incl. VAT)"` — that `.` is
 * not a decimal point) is prose by construction and never reaches this function.
 *
 * The residue: prose whose only word is glued to a parenthesised value
 * (`"Save(50)"`, no space) still reads as a misspelled call under signal 2 and
 * stores the empty string. Writing it with a space — `"Save (50)"` — is now
 * genuinely the fix, which is what the previous revision of this comment
 * claimed while the code did the opposite.
 */
const isBareWord = (t: Token, next: Token | undefined) =>
  t.kind === "ident" && next?.kind !== "lparen";

/**
 * True when the parenthesised group opening at `open` holds a bare word at any
 * depth — i.e. something that cannot be an argument, so the group is prose.
 * An unbalanced group holds nothing and answers false; the parse fails on it
 * regardless, and the two signals above decide it on the name instead.
 */
function argsHoldBareWord(tokens: Token[], open: number): boolean {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "lparen") {
      depth++;
      continue;
    }
    if (t.kind === "rparen") {
      depth--;
      if (depth === 0) return false;
      continue;
    }
    if (depth > 0 && isBareWord(t, tokens[i + 1])) return true;
  }
  return false;
}

/**
 * A stdlib call whose arguments contain a bare word: `count(goals)` — almost
 * certainly `count({{goals}})` with the braces forgotten.
 *
 * `argsHoldBareWord` runs before the `STDLIB_NAMES` check in `isCallAttempt`,
 * deliberately, because `{{n}} min(s) left` has the identical token shape and
 * nothing in the stream separates them. So the classification stays prose —
 * rendering the author's copy is the safe answer for the ambiguous case — and
 * this exists only so the other reading is not SILENT. `count(goals)` stored
 * its own source text into a variable a headline then displayed.
 *
 * Reported when the call is the WHOLE template, or when an operator appears
 * outside its parens: `count(goals) + " goals"` and `1 + count(goals)` cannot
 * be the optional-plural idiom, which is prose and carries no operators. The
 * remaining false positive is a template that is exactly a stdlib word plus a
 * parenthesised suffix (`min(s)`) — the text is kept, so the cost is one
 * advisory warning, and `valueMode: "literal"` is the right mode for a
 * constant anyway.
 */
function unbracedCall(tokens: Token[]): { name: string; args: string[] } | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== "ident" || isBareWord(t, tokens[i + 1]) || !STDLIB_NAMES.has(t.name)) continue;
    // Find the paren that closes this call site.
    let depth = 0;
    let close = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].kind === "lparen") depth++;
      else if (tokens[j].kind === "rparen" && --depth === 0) {
        close = j;
        break;
      }
    }
    if (close === -1) continue;
    // Only the bare-word identifiers, taken from the token stream. Building a
    // suggested template out of the raw source instead would brace names
    // inside string literals and nested calls, and `format({{d}}, "{{medium}}")`
    // is worse advice than none — it blanks.
    const args: string[] = [];
    for (let j = i + 2; j < close; j++) {
      const a = tokens[j];
      if (a.kind === "ident" && isBareWord(a, tokens[j + 1])) args.push(a.name);
    }
    if (args.length === 0) continue;
    const spansTemplate = i === 0 && close === tokens.length - 2;
    const operatorOutside = tokens.some((x, j) => x.kind === "op" && (j < i || j > close));
    if (spansTemplate || operatorOutside) return { name: t.name, args };
  }
  return null;
}

function isCallAttempt(tokens: Token[]): boolean {
  let knownCall = false;
  let gluedUnknownCall = false;
  let bareWord = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== "ident") continue;
    if (isBareWord(t, tokens[i + 1])) {
      bareWord = true;
      continue;
    }
    // Parentheses used as punctuation around prose — not a call site at all.
    if (argsHoldBareWord(tokens, i + 1)) continue;
    if (STDLIB_NAMES.has(t.name)) knownCall = true;
    else if (t.glued) gluedUnknownCall = true;
  }
  if (knownCall) return true;
  return gluedUnknownCall && !bareWord;
}

function parse(tokens: Token[], vars: Record<string, ComposableVariableEntry>): Value | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const advance = () => tokens[pos++];

  const factor = (): Value | null => {
    const t = peek();
    if (t.kind === "lparen") {
      advance();
      const v = expr();
      if (!v) return null;
      if (peek().kind !== "rparen") return null;
      advance();
      return v;
    }
    if (t.kind === "op" && t.op === "-") {
      advance();
      const v = factor();
      if (!v || v.kind !== "number") return null;
      return { kind: "number", n: -v.n, isInt: v.isInt, unseeded: v.unseeded };
    }
    if (t.kind === "num") {
      advance();
      return { kind: "number", n: t.value, isInt: t.isInt };
    }
    if (t.kind === "str") {
      advance();
      // A literal's CONTENTS interpolate, so `{{var}}` means the same thing
      // everywhere in a template — `list({{goals}}) + " for {{name}}"` reads
      // "… for Ada" rather than emitting the braces to the user. Format specs,
      // separators and plural forms contain no `{{`, so they pass through
      // byte-identical. Label-first, like every other display path.
      return { kind: "string", s: interpolate(t.value, vars) };
    }
    if (t.kind === "var") {
      advance();
      return resolveVar(t.name, vars);
    }
    if (t.kind === "ident") {
      advance();
      if (peek().kind !== "lparen") return null;
      advance();
      const args: Value[] = [];
      if (peek().kind === "rparen") {
        advance();
      } else {
        for (;;) {
          // Arguments are full expressions, so `addDays({{d}}, {{weeks}} * 7)`
          // and nested calls both work.
          const arg = expr();
          if (!arg) return null;
          args.push(arg);
          const next = peek();
          if (next.kind === "comma") { advance(); continue; }
          if (next.kind === "rparen") { advance(); break; }
          return null;
        }
      }
      return callFunction(t.name, args);
    }
    return null;
  };

  const term = (): Value | null => {
    let left = factor();
    if (!left) return null;
    while (peek().kind === "op" && ((peek() as any).op === "*" || (peek() as any).op === "/")) {
      const op = (advance() as any).op as "*" | "/";
      const right = factor();
      if (!right) return null;
      if (left.kind !== "number" || right.kind !== "number") return null;
      if (op === "/" && right.n === 0) return null;
      const result: number = op === "*" ? left.n * right.n : left.n / right.n;
      if (!Number.isFinite(result)) return null;
      const isInt: boolean = op === "*" ? left.isInt && right.isInt : Number.isInteger(result);
      left = { kind: "number", n: result, isInt, unseeded: left.unseeded || right.unseeded };
    }
    return left;
  };

  const expr = (): Value | null => {
    let left = term();
    if (!left) return null;
    while (peek().kind === "op" && ((peek() as any).op === "+" || (peek() as any).op === "-")) {
      const op = (advance() as any).op as "+" | "-";
      const right = term();
      if (!right) return null;
      if (op === "+") {
        if (left.kind === "number" && right.kind === "number") {
          left = {
            kind: "number",
            n: left.n + right.n,
            isInt: left.isInt && right.isInt,
            unseeded: left.unseeded || right.unseeded,
          };
        } else {
          left = { kind: "string", s: valueToString(left) + valueToString(right) };
        }
      } else {
        if (left.kind !== "number" || right.kind !== "number") return null;
        left = {
          kind: "number",
          n: left.n - right.n,
          isInt: left.isInt && right.isInt,
          unseeded: left.unseeded || right.unseeded,
        };
      }
    }
    return left;
  };

  const result = expr();
  if (!result) return null;
  if (peek().kind !== "eof") return null;
  return result;
}

/**
 * Evaluate a `setVariable` expression-mode value template.
 *
 * Accepts `{{var}}` references, numeric literals (int / float), quoted string
 * literals, `+ - * /`, parentheses, and the function stdlib:
 *
 * - numeric — `min(a, b, ...)`, `max(a, b, ...)`, `abs(a)`, `round(a[, digits])`,
 *   `clamp(a, lo, hi)`
 * - dates — `addDays(date, n)`, `format(date, spec[, locale])`. `date` is an
 *   ISO string (what DatePicker stores) or the `"now"` sentinel; `spec` uses the
 *   DatePicker `format` prop's Intl vocabulary, either a bare `dateStyle` name
 *   (`"medium"`) or `key:value` pairs (`"weekday:long, day:numeric"`).
 * - listing — `list(x[, conjunction])` ("A, B and C"), `join(x[, separator])`,
 *   `count(x)`, `plural(n, one, other)`. `x` is an untagged multi-select
 *   variable; its member LABELS are used when present. A scalar answer is one
 *   member, also by its label. Two things are NOT lists and fail the call
 *   rather than counting as one: a variable holding a number (`count({{age}})`
 *   — you wanted `plural({{age}}, ...)`), and a value that parses as JSON but
 *   is not a `string[]` (`"[1,2,3]"`, `{"a":1}`).
 *
 * Variable values are coerced according to their `kind` tag (string / int /
 * float), or inferred from their string content when no tag is present — an
 * untagged JSON `string[]` is a member list. `+` on any non-numeric operand
 * becomes string concat.
 *
 * A quoted literal's CONTENTS interpolate, so `{{var}}` means the same thing
 * everywhere in the template — `list({{goals}}) + " for {{name}}"` reads
 * "… for Ada" rather than emitting the braces to the user. Format specs,
 * separators and plural forms hold no `{{`, so they pass through unchanged.
 *
 * Failure handling differs by template shape:
 * - a template with no function call falls back to plain interpolation
 *   (unchanged `interpolate()` semantics), because `"Hello {{name}}"` is a
 *   legitimate expression-mode value — and so is `"{{n}} day(s)"` and
 *   `"Goals ({{n}})"`, which are prose rather than failed calls (see
 *   `isCallAttempt` for the two signals that decide it)
 * - a template that ATTEMPTS a call and fails returns the empty string and
 *   warns, rather than interpolating the broken source into a variable that a
 *   headline would then display verbatim. That includes a VALID call with prose
 *   beside it (`list({{goals}}) and more`) — this grammar has no implicit
 *   concatenation, so the prose has to be `+ " and more"`
 * - an ABSENT variable reads as numeric 0 wherever it is data, but is refused
 *   as a `clamp` bound or a `round` digit count — see `isUnseeded`
 */
export function evaluateSetVariableExpression(
  template: string,
  vars: Record<string, ComposableVariableEntry>
): { value: string; kind: ComposableVariableKind } {
  // DO NOT wrap this body in a blanket try/catch, however tempting it looks:
  // the stdlib runs from a press handler that nothing guards (`ButtonElement`
  // awaits inside an async onPress, `renderElement` calls `void
  // runActions(...)`), so an escaping exception is a dead button with no
  // console output, and a catch-all here would seem to fix that.
  //
  // It would also silently disarm this file's entire test suite. Every guard
  // below is pinned by a test asserting the same observable outcome a catch-all
  // would produce — the empty string plus one warning — so a catch-all makes
  // all of those tests pass whether or not the guard they name still exists,
  // and the next real throw becomes invisible to CI instead of failing it.
  // Guard at the throw site (see `addDays`'s range check and `format`'s
  // try/catch), and mutation-test the guard by deleting it and watching the
  // test fail.
  const tokens = tokenize(template);
  if (tokens) {
    const result = parse(tokens, vars);
    if (result) {
      if (result.kind === "number") {
        return { value: valueToString(result), kind: result.isInt ? "int" : "float" };
      }
      // A bare multi-select reference stringifies to its raw JSON, as before.
      return { value: valueToString(result), kind: "string" };
    }
    if (isCallAttempt(tokens)) {
      console.warn(
        `[ComposableScreen] setVariable expression failed to evaluate: ${template}. ` +
          "Check the function name, its argument count and any date/format string. " +
          'There is no implicit concatenation: prose beside a call must be joined with + "…". ' +
          "Stored the empty string rather than the unevaluated template."
      );
      return { value: "", kind: "string" };
    }
    const unbraced = unbracedCall(tokens);
    if (unbraced) {
      const braced = unbraced.args.map((a) => `{{${a}}}`).join(", ");
      console.warn(
        `[ComposableScreen] setVariable expression stored as text, not evaluated: ${template}. ` +
          `\`${unbraced.name}\` is a stdlib function, but ${unbraced.args
            .map((a) => `\`${a}\``)
            .join(", ")} ${unbraced.args.length === 1 ? "is a bare word" : "are bare words"} ` +
          `rather than a variable reference — if you meant the function, write ${braced}. ` +
          "Copy like `{{n}} min(s) left` has the same shape, so the text was kept, not blanked."
      );
    }
  }
  return { value: interpolate(template, vars), kind: "string" };
}
