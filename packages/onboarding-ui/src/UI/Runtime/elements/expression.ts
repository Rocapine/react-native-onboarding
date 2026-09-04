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
  | { kind: "ident"; name: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "eof" };

type Value =
  // `missing: true` marks the numeric-0 default an *absent* variable resolves to.
  // Arithmetic ignores the flag (every result is a fresh object), but the list
  // helpers read it so `count({{never_answered}})` is 0 rather than a hard fail.
  | { kind: "number"; n: number; isInt: boolean; missing?: boolean }
  | { kind: "string"; s: string }
  // A multi-select variable (the JSON-encoded `string[]` CheckboxGroup writes).
  // `items` are the member LABELS when available (matching `interpolate`'s
  // label-first display precedence); `raw` is the original JSON string so
  // `valueToString` — and therefore string concat — is byte-identical to the
  // behaviour before this Value kind existed.
  | { kind: "list"; items: string[]; raw: string };

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
      tokens.push({ kind: "ident", name: input.slice(i, j) });
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
  if (!entry) return { kind: "number", n: 0, isInt: true, missing: true };
  const raw = entry.value;
  const k = entry.kind;
  if (k === "string") return { kind: "string", s: raw };
  if (k === "int") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? { kind: "number", n, isInt: true } : { kind: "string", s: raw };
  }
  if (k === "float") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? { kind: "number", n, isInt: false } : { kind: "string", s: raw };
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
    return {
      kind: "list",
      items: labels && labels.length === items.length ? labels : items,
      raw,
    };
  }
  const trimmed = raw.trim();
  if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (Number.isFinite(n)) return { kind: "number", n, isInt: Number.isInteger(n) && !trimmed.includes(".") };
  }
  return { kind: "string", s: raw };
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
  return out as Intl.DateTimeFormatOptions;
}

// Coercions. Each returns null when the value is the wrong shape, which the
// caller turns into a whole-expression hard failure.
const asNumber = (v: Value): { n: number; isInt: boolean } | null =>
  v.kind === "number" ? { n: v.n, isInt: v.isInt } : null;

const asText = (v: Value): string => valueToString(v);

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
  if (v.kind === "list") return v.items;
  // An unset variable resolves to numeric 0; treat it as an empty selection so
  // `count()` / `list()` on a screen the user skipped are 0 and "".
  if (v.kind === "number") return v.missing ? [] : null;
  const decoded = decodeStringArray(v.s);
  if (decoded) return decoded;
  return v.s.trim() === "" ? [] : [v.s];
}

/** "A", "A and B", "A, B and C" — no Oxford comma. */
function grammaticalList(items: string[], conjunction: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const head = items.slice(0, -1);
  const tail = items[items.length - 1];
  return `${head.join(", ")} ${conjunction} ${tail}`;
}

function callFunction(name: string, args: Value[]): Value | null {
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
      const n = asNumber(args[1]);
      if (!d || !n) return null;
      // A "day" here is exactly 24h of wall-clock-agnostic time, applied to the
      // UTC instant DatePicker stores. Crossing a DST boundary therefore shifts
      // the local time-of-day by an hour; use `format()` for display and don't
      // rely on the time component.
      const t = d.getTime() + n.n * DAY_MS;
      if (!Number.isFinite(t)) return null;
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

// A stdlib call is the only legitimate reason for an identifier to appear in an
// expression template — the grammar has no bare identifiers otherwise. So a
// template containing `ident(` is a call attempt, and a failure to evaluate it
// is a HARD failure rather than something to paper over by interpolating the
// broken source text into a user-visible variable.
const LOOKS_LIKE_CALL = /[A-Za-z_$][A-Za-z0-9_$]*\(/;

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
      return { kind: "number", n: -v.n, isInt: v.isInt };
    }
    if (t.kind === "num") {
      advance();
      return { kind: "number", n: t.value, isInt: t.isInt };
    }
    if (t.kind === "str") {
      advance();
      return { kind: "string", s: t.value };
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
      left = { kind: "number", n: result, isInt };
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
          left = { kind: "number", n: left.n + right.n, isInt: left.isInt && right.isInt };
        } else {
          left = { kind: "string", s: valueToString(left) + valueToString(right) };
        }
      } else {
        if (left.kind !== "number" || right.kind !== "number") return null;
        left = { kind: "number", n: left.n - right.n, isInt: left.isInt && right.isInt };
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
 *   `count(x)`, `plural(n, one, other)`. `x` is a multi-select variable; its
 *   member LABELS are used when present.
 *
 * Variable values are coerced according to their `kind` tag (string / int /
 * float), or inferred from their string content when no tag is present — an
 * untagged JSON `string[]` is a member list. `+` on any non-numeric operand
 * becomes string concat.
 *
 * Failure handling differs by template shape:
 * - a template with no function call falls back to plain interpolation
 *   (unchanged `interpolate()` semantics), because `"Hello {{name}}"` is a
 *   legitimate expression-mode value
 * - a template that ATTEMPTS a call and fails returns the empty string and
 *   warns, rather than interpolating the broken source into a variable that a
 *   headline would then display verbatim
 */
export function evaluateSetVariableExpression(
  template: string,
  vars: Record<string, ComposableVariableEntry>
): { value: string; kind: ComposableVariableKind } {
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
  }
  if (LOOKS_LIKE_CALL.test(template)) {
    console.warn(
      `[ComposableScreen] setVariable expression failed to evaluate: ${template}. ` +
        "Check the function name, its argument count and any date/format string. " +
        "Stored the empty string rather than the unevaluated template."
    );
    return { value: "", kind: "string" };
  }
  return { value: interpolate(template, vars), kind: "string" };
}
