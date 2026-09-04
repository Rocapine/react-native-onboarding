import { describe, it, expect, vi, afterEach } from "vitest";
import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";
import { evaluateSetVariableExpression } from "../elements/expression";

type Vars = Record<string, ComposableVariableEntry>;

const ev = (template: string, vars: Vars = {}) =>
  evaluateSetVariableExpression(template, vars);

// A CheckboxGroup-written multi-select variable: JSON-encoded string[] in
// `value`, ", "-joined member labels in `label`, no `kind` tag.
const goals: Vars = {
  goals: {
    value: JSON.stringify(["sleep", "energy", "focus"]),
    label: "Sleep, Energy, Focus",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("expression stdlib — arithmetic regressions", () => {
  it("still evaluates bare arithmetic with parens", () => {
    expect(ev("({{w}} / 2) + 1", { w: { value: "10", kind: "int" } })).toEqual({
      value: "6",
      kind: "int",
    });
  });

  it("still falls back to interpolation for a non-expression template", () => {
    expect(ev("Hello {{name}}", { name: { value: "Ada" } })).toEqual({
      value: "Hello Ada",
      kind: "string",
    });
  });

  it("still concatenates a multi-select variable as its raw JSON value", () => {
    // Not a behaviour anyone should rely on, but it must not change silently.
    expect(ev('"" + {{goals}}', goals).value).toBe('["sleep","energy","focus"]');
  });
});

describe("expression stdlib — numeric functions", () => {
  it("min returns the smaller of two arguments", () => {
    expect(ev("min(3, 7)")).toEqual({ value: "3", kind: "int" });
  });

  it("max is variadic", () => {
    expect(ev("max(3, 7, 5)")).toEqual({ value: "7", kind: "int" });
  });

  it("abs makes a negative difference positive", () => {
    expect(ev("abs({{a}} - {{b}})", {
      a: { value: "3", kind: "int" },
      b: { value: "11", kind: "int" },
    })).toEqual({ value: "8", kind: "int" });
  });

  it("round rounds to nearest, unlike the engine's incidental Math.trunc", () => {
    expect(ev("round(2.6)")).toEqual({ value: "3", kind: "int" });
    expect(ev("round(2.4)")).toEqual({ value: "2", kind: "int" });
  });

  it("round takes an optional digit count and stays a float", () => {
    expect(ev("round(10 / 3, 2)")).toEqual({ value: "3.33", kind: "float" });
  });

  it("clamp holds a value inside an inclusive range", () => {
    expect(ev("clamp({{n}}, 1, 10)", { n: { value: "42", kind: "int" } })).toEqual({
      value: "10",
      kind: "int",
    });
    expect(ev("clamp({{n}}, 1, 10)", { n: { value: "-3", kind: "int" } })).toEqual({
      value: "1",
      kind: "int",
    });
    expect(ev("clamp({{n}}, 1, 10)", { n: { value: "5", kind: "int" } })).toEqual({
      value: "5",
      kind: "int",
    });
  });

  it("propagates float-ness from any argument", () => {
    expect(ev("min(3, 2.5)")).toEqual({ value: "2.5", kind: "float" });
  });

  it("composes with arithmetic in both directions", () => {
    expect(ev("clamp(round({{kg}} / 4), 1, 3) * 2", { kg: { value: "9", kind: "int" } })).toEqual({
      value: "4",
      kind: "int",
    });
  });
});

describe("expression stdlib — date functions", () => {
  it("addDays offsets the 'now' literal, reusing the DatePicker convention", () => {
    const before = Date.now();
    const out = ev('addDays("now", 30)');
    const after = Date.now();
    expect(out.kind).toBe("string");
    const t = Date.parse(out.value);
    expect(Number.isNaN(t)).toBe(false);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(t).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(t).toBeLessThanOrEqual(after + thirtyDays);
  });

  it("addDays offsets an ISO date held in a variable", () => {
    expect(ev("addDays({{start}}, 7)", {
      start: { value: "2026-01-01T00:00:00.000Z" },
    }).value).toBe("2026-01-08T00:00:00.000Z");
  });

  it("addDays accepts a negative offset", () => {
    expect(ev("addDays({{start}}, 0 - 1)", {
      start: { value: "2026-01-01T00:00:00.000Z" },
    }).value).toBe("2025-12-31T00:00:00.000Z");
  });

  it("addDays accepts a computed day count", () => {
    expect(ev("addDays({{start}}, {{weeks}} * 7)", {
      start: { value: "2026-01-01T00:00:00.000Z" },
      weeks: { value: "2", kind: "int" },
    }).value).toBe("2026-01-15T00:00:00.000Z");
  });

  it("format renders a dateStyle name from the DatePicker Intl subset", () => {
    expect(ev('format({{d}}, "long", "en-US")', {
      d: { value: "2026-03-04T12:00:00.000Z" },
    })).toEqual({ value: "March 4, 2026", kind: "string" });
  });

  it("format renders component fields by their Intl option names", () => {
    expect(ev('format({{d}}, "weekday:long, month:short, day:numeric", "en-US")', {
      d: { value: "2026-03-04T12:00:00.000Z" },
    }).value).toBe("Wednesday, Mar 4");
  });

  it("format composes over addDays — the computed goal date case", () => {
    expect(ev('format(addDays({{start}}, 90), "medium", "en-US")', {
      start: { value: "2026-01-01T12:00:00.000Z" },
    }).value).toBe("Apr 1, 2026");
  });

  it("format rejects an unknown Intl option name rather than ignoring it", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev('format({{d}}, "weekdays:long", "en-US")', {
      d: { value: "2026-03-04T12:00:00.000Z" },
    })).toEqual({ value: "", kind: "string" });
  });

  it("addDays on an unparseable date falls back instead of yielding Invalid Date", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("addDays({{d}}, 1)", { d: { value: "not a date" } })).toEqual({
      value: "",
      kind: "string",
    });
  });
});

describe("expression stdlib — format spec hardening", () => {
  // Regression guards for branches that are easy to delete by accident. Each
  // was verified to produce this result, and each protects against a real
  // hazard rather than restating the happy path.
  it("returns empty rather than THROWING when Intl rejects the option mix", () => {
    // Intl throws if dateStyle/timeStyle is combined with component fields.
    // Without the try/catch around toLocaleString that exception escapes into
    // the press handler that ran the action.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      ev('format({{d}}, "dateStyle:medium, weekday:long")', {
        d: { value: "2026-03-04T12:00:00.000Z" },
      })
    ).not.toThrow();
    expect(
      ev('format({{d}}, "dateStyle:medium, weekday:long")', {
        d: { value: "2026-03-04T12:00:00.000Z" },
      }).value
    ).toBe("");
  });

  it("rejects an invalid locale instead of throwing RangeError", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      ev('format({{d}}, "medium", "not a locale!!")', {
        d: { value: "2026-03-04T12:00:00.000Z" },
      }).value
    ).toBe("");
  });

  it("rejects inherited Object keys as option names", () => {
    // The allowlist uses hasOwnProperty, so `__proto__` / `toString` are not
    // mistaken for valid Intl options and cannot reach the options object.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const spec of ["__proto__:long", "toString:long", "constructor:long"]) {
      expect(ev(`format({{d}}, "${spec}")`, {
        d: { value: "2026-03-04T12:00:00.000Z" },
      }).value).toBe("");
    }
  });

  it("rejects a duplicated option key", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev('format({{d}}, "month:long, month:short")', {
      d: { value: "2026-03-04T12:00:00.000Z" },
    }).value).toBe("");
  });

  it("rejects a trailing comma in an argument list", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("min(3,)").value).toBe("");
  });
});

describe("expression stdlib — listing and pluralization", () => {
  it("list grammatically joins member labels with 'and'", () => {
    expect(ev("list({{goals}})", goals)).toEqual({
      value: "Sleep, Energy and Focus",
      kind: "string",
    });
  });

  it("list takes a conjunction override", () => {
    expect(ev('list({{goals}}, "or")', goals).value).toBe("Sleep, Energy or Focus");
  });

  it("list of two members has no comma", () => {
    expect(ev("list({{g}})", {
      g: { value: '["a","b"]', label: "Sleep, Energy" },
    }).value).toBe("Sleep and Energy");
  });

  it("list of one member is that member", () => {
    expect(ev("list({{g}})", { g: { value: '["a"]', label: "Sleep" } }).value).toBe("Sleep");
  });

  it("list of an empty selection is the empty string", () => {
    expect(ev("list({{g}})", { g: { value: "[]", label: "" } })).toEqual({
      value: "",
      kind: "string",
    });
  });

  it("list falls back to raw values when there is no label", () => {
    expect(ev("list({{g}})", { g: { value: '["sleep","energy"]' } }).value).toBe(
      "sleep and energy"
    );
  });

  it("uses raw values, not labels, for an explicitly kind-tagged array", () => {
    // `kind: "string"` is taken at its word, so the entry is not treated as a
    // member list and the labels are not consulted. CheckboxGroup and
    // `setVariable arrayOp` never write a `kind`, so this only bites a
    // hand-authored `setVariable` that tags an array variable as a string.
    expect(ev("list({{g}})", {
      g: { value: '["a","b"]', label: "A, B", kind: "string" },
    }).value).toBe("a and b");
  });

  it("join uses an author-supplied separator instead of the hardcoded ', '", () => {
    expect(ev('join({{goals}}, " · ")', goals).value).toBe("Sleep · Energy · Focus");
  });

  it("join defaults to ', ' — the existing CheckboxGroup label shape", () => {
    expect(ev("join({{goals}})", goals).value).toBe("Sleep, Energy, Focus");
  });

  it("count returns the number of selected members as an int", () => {
    expect(ev("count({{goals}})", goals)).toEqual({ value: "3", kind: "int" });
  });

  it("count of an unset multi-select variable is 0", () => {
    expect(ev("count({{never_touched}})")).toEqual({ value: "0", kind: "int" });
  });

  it("count composes into arithmetic", () => {
    expect(ev("count({{goals}}) * 10", goals)).toEqual({ value: "30", kind: "int" });
  });

  it("plural picks the 'other' form for a count of 3", () => {
    expect(ev('plural(count({{goals}}), "goal", "goals")', goals).value).toBe("goals");
  });

  it("plural picks the 'one' form for a count of 1", () => {
    expect(ev('plural(1, "day", "days")').value).toBe("day");
  });

  it("plural assembles a full sentence by concatenation", () => {
    expect(ev(
      'count({{goals}}) + " " + plural(count({{goals}}), "goal", "goals") + ": " + list({{goals}})',
      goals
    ).value).toBe("3 goals: Sleep, Energy and Focus");
  });
});

describe("expression stdlib — failure reporting", () => {
  it("warns when a function-shaped template fails to parse", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("addDayz({{d}}, 1)", { d: { value: "2026-01-01T00:00:00.000Z" } }).value).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("addDayz");
  });

  it("does not warn for a plain interpolation template", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("Hello {{name}}", { name: { value: "Ada" } }).value).toBe("Hello Ada");
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects a wrong argument count", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("clamp(5, 1)").value).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("expression stdlib — Date range hardening", () => {
  // `Number.isFinite(t)` is true for any t up to ~1.8e308, but `new Date(t)` is
  // an Invalid Date beyond ±8.64e15 ms and `.toISOString()` THROWS there. The
  // throw escapes `evaluateSetVariableExpression` into the press handler that
  // ran the action (`ButtonElement.tsx` awaits inside an async onPress;
  // `renderElement.tsx` calls `void runActions(...)`), so the button dies
  // silently: no warning, no later actions, no continue.
  it("does not THROW on a day count that overflows the Date range", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // The realistic trigger: a units mistake, seconds where days were meant.
    const template = 'addDays("now", 90 * 365 * 24 * 60 * 60)';
    expect(() => ev(template)).not.toThrow();
    expect(ev(template)).toEqual({ value: "", kind: "string" });
  });

  it("does not THROW when a VARIABLE carries the out-of-range offset", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // The shape that will actually reach production is not a hand-typed
    // literal but a variable holding a millisecond timestamp or a duration in
    // ms, passed where days were meant. This also pins the `asNumber` path
    // rather than the numeric-literal token.
    const vars: Vars = {
      t: { value: "2026-01-01T00:00:00.000Z" },
      ms: { value: "1767225600000", kind: "int" },
    };
    expect(() => ev("addDays({{t}}, {{ms}})", vars)).not.toThrow();
    expect(ev("addDays({{t}}, {{ms}})", vars)).toEqual({ value: "", kind: "string" });
  });

  it("warns exactly once on an overflowing day count, like any other failure", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    ev('addDays("now", 100000000000)');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("addDays");
  });

  it("still evaluates the largest representable instant — the guard must not over-reject", () => {
    // Exactly 1e8 days after the epoch is 8.64e15 ms: the maximum valid
    // instant, which `toISOString()` renders fine. A `>=` guard would break it.
    expect(ev('addDays("1970-01-01T00:00:00.000Z", 100000000)').value).toBe(
      "+275760-09-13T00:00:00.000Z"
    );
    expect(ev('addDays("1970-01-01T00:00:00.000Z", 0 - 100000000)').value).toBe(
      "-271821-04-20T00:00:00.000Z"
    );
  });

  it("keeps the date functions on the machine value, not the label", () => {
    // A DatePicker writes the ISO instant in `value` and its formatted display
    // text in `label`. The list helpers are label-first; `asDate` must not be,
    // or a date variable stops parsing the moment it has a label.
    //
    // The label is a DIFFERENT, parseable date on purpose. A realistic label
    // that formats back to the same day ("1 January 1990" beside
    // 1990-01-01T00:00:00.000Z) passes whichever field `asDate` reads — under
    // `TZ=UTC`, which is what CI runs, the two parse to the same millisecond —
    // so that version of this test proved nothing.
    const differentDate = {
      birthdate: { value: "1990-01-01T00:00:00.000Z", label: "March 3, 2021" },
    };
    expect(ev('format({{birthdate}}, "medium", "en-US")', differentDate).value).toBe(
      "Jan 1, 1990"
    );
    expect(ev("addDays({{birthdate}}, 1)", differentDate).value).toBe(
      "1990-01-02T00:00:00.000Z"
    );

    // And a label that is not a date at all must not break the date functions:
    // label-first here would fail to parse and degrade the whole call to "".
    const prose = {
      birthdate: { value: "1990-01-01T00:00:00.000Z", label: "your birthday" },
    };
    expect(ev("addDays({{birthdate}}, 1)", prose).value).toBe("1990-01-02T00:00:00.000Z");
  });

  it("degrades one day past each end of the range", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev('addDays("1970-01-01T00:00:00.000Z", 100000001)').value).toBe("");
    expect(ev('addDays("1970-01-01T00:00:00.000Z", 0 - 100000001)').value).toBe("");
    // Date.parse itself clamps at ±8.64e15 (it returns NaN past the maximum),
    // so this is the largest date a payload can even hold — +1 day is over.
    expect(() => ev('addDays("+275760-09-13T00:00:00.000Z", 1)')).not.toThrow();
    expect(ev('addDays("+275760-09-13T00:00:00.000Z", 1)').value).toBe("");
  });
});

describe("expression stdlib — structured data of the wrong shape", () => {
  // `decodeStringArray` correctly refuses a non-`string[]`, but the value then
  // fell through to the scalar branch and became a ONE-MEMBER list, so
  // `count()` answered a plausible 1 with no warning. A believable constant is
  // the worst failure mode this runtime can have; JSON that parses but is the
  // wrong shape is an authoring error, never a scalar answer, so it hard-fails.
  const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("count fails loudly on a JSON array that is not a string[]", () => {
    const warn = warnSpy();
    expect(ev("count({{g}})", { g: { value: "[1,2,3]" } })).toEqual({
      value: "",
      kind: "string",
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("count fails loudly on a JSON object", () => {
    warnSpy();
    expect(ev("count({{g}})", { g: { value: '{"a":1}' } }).value).toBe("");
  });

  it("count fails loudly on a mixed array", () => {
    warnSpy();
    expect(ev("count({{g}})", { g: { value: '["a",1]' } }).value).toBe("");
    expect(ev("count({{g}})", { g: { value: '[["a"],["b"]]' } }).value).toBe("");
  });

  it("join and list fail loudly on the same value instead of echoing raw JSON", () => {
    warnSpy();
    expect(ev("join({{g}})", { g: { value: "[1,2,3]" } }).value).toBe("");
    expect(ev("list({{g}})", { g: { value: "[1,2,3]" } }).value).toBe("");
  });

  it("still treats a free-text answer that merely looks bracketed as one member", () => {
    // Not JSON, so not structured data of the wrong shape — a user who typed
    // "[not json]" into an Input has given one answer, and count is 1.
    expect(ev("count({{g}})", { g: { value: "[not json]" } })).toEqual({
      value: "1",
      kind: "int",
    });
  });

  it("counts a single-select scalar answer as one member, by its label", () => {
    // `list` / `join` are display helpers and every other display path is
    // label-first (`interpolate`, shared.ts:72), so a scalar has to read like
    // the multi-select beside it: "You chose Improve health", never
    // "You chose health".
    const choice = { choice: { value: "health", label: "Improve health" } };
    expect(ev("count({{choice}})", choice)).toEqual({ value: "1", kind: "int" });
    expect(ev("list({{choice}})", choice).value).toBe("Improve health");
    expect(ev("join({{choice}})", choice).value).toBe("Improve health");
    // No label — the machine value is all there is.
    expect(ev("list({{choice}})", { choice: { value: "health" } }).value).toBe("health");
    // String concat is deliberately NOT label-first and stays on the value.
    expect(ev('"" + {{choice}}', choice).value).toBe("health");
  });

  it("fails the list helpers on a variable that holds a number", () => {
    // `count({{age}})` is a type error, not a 1: the author wanted
    // `plural({{age}}, ...)`. Both the tagged and the sniffed-numeric shapes
    // reach it, and this is what the docs now say — they previously promised a
    // scalar always counts as one, which was false for every numeric answer.
    warnSpy();
    expect(ev("count({{age}})", { age: { value: "30", kind: "int" } }).value).toBe("");
    expect(ev("count({{age}})", { age: { value: "30.5", kind: "float" } }).value).toBe("");
    expect(ev("count({{age}})", { age: { value: "30" } }).value).toBe("");
    // A non-numeric scalar is still one member, and an UNSET variable is still
    // an empty selection rather than a failure.
    expect(ev("count({{age}})", { age: { value: "thirty" } })).toEqual({
      value: "1",
      kind: "int",
    });
    expect(ev("count({{never_set}})")).toEqual({ value: "0", kind: "int" });
  });

  it("leaves string concatenation of the same value untouched", () => {
    // Only the list helpers gained an opinion; `+` still stringifies whatever
    // the variable holds, exactly as before.
    expect(ev('"" + {{g}}', { g: { value: "[1,2,3]" } }).value).toBe("[1,2,3]");
  });
});

describe("expression stdlib — prose is not a call attempt", () => {
  // Review finding on #243. `word(` used to be enough to declare the template a
  // failed call and store the empty string, which broke the English
  // optional-plural idiom — the single most common shape of prose that contains
  // a parenthesis. A call attempt is now a property of the TOKEN STREAM (every
  // identifier is a function name, i.e. immediately followed by `(`), not of a
  // substring, so prose keeps falling back to plain interpolation while a real
  // call still fails loudly.
  const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("interpolates the optional-plural idiom rather than storing the empty string", () => {
    const warn = warnSpy();
    expect(ev("{{n}} day(s)", { n: { value: "3", kind: "int" } })).toEqual({
      value: "3 day(s)",
      kind: "string",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("interpolates prose whose parenthesis sits against a word", () => {
    warnSpy();
    expect(ev("{{n}} min(s) left", { n: { value: "3", kind: "int" } }).value).toBe(
      "3 min(s) left"
    );
    // Lexically not an expression at all (the `.` is not a decimal point), so
    // there is no token stream and the template is prose by construction.
    expect(ev("{{p}} EUR(incl. VAT)", { p: { value: "9", kind: "int" } }).value).toBe(
      "9 EUR(incl. VAT)"
    );
    // A parenthesis with a space before it was never affected; pinned so the
    // new rule cannot regress it either.
    expect(ev("Plan (recommended) {{n}}", { n: { value: "3", kind: "int" } }).value).toBe(
      "Plan (recommended) 3"
    );
  });

  it("still fails loudly when every identifier is a called function name", () => {
    const warn = warnSpy();
    // A misspelling is a call attempt: `addDay` is followed by `(` and nothing
    // else in the template is a bare word.
    expect(ev("addDay({{d}}, 1)", { d: { value: "2026-01-01T00:00:00.000Z" } }).value).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("interpolates a word followed by a spaced parenthesised number", () => {
    // Second review finding on #243. The token stream is whitespace-free, so
    // `"Goals ({{count}})"` and `"Goals({{count}})"` tokenize identically —
    // which made the very shape the previous comment recommended ("write it
    // with a space") store the empty string. The comment's advice is now true
    // because a call site has to be GLUED to its parenthesis or carry a known
    // stdlib name.
    const warn = warnSpy();
    const n = { n: { value: "2", kind: "int" as const } };
    expect(ev("Goals ({{n}})", n).value).toBe("Goals (2)");
    expect(ev("Save (50)").value).toBe("Save (50)");
    expect(ev("Deposit (100)").value).toBe("Deposit (100)");
    expect(ev("Basic ({{n}})", n).value).toBe("Basic (2)");
    expect(ev("Week ({{n}}-{{n}})", n).value).toBe("Week (2-2)");
    expect(warn).not.toHaveBeenCalled();
  });

  it("fails loudly when a real call is followed by unconcatenated prose", () => {
    // Third review finding on #243. `and`/`more` are bare words, so the whole
    // template used to read as prose and the evaluator's OWN SOURCE — function
    // name, parentheses and all — was interpolated into the variable with no
    // warning. A known stdlib name at a call site outranks any bare word.
    const warn = warnSpy();
    expect(ev("list({{goals}}) and more", goals).value).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('+ "');
    expect(ev("count({{goals}}) goals", goals).value).toBe("");
    // The remedy, pinned so the warning's advice stays true.
    expect(ev('count({{goals}}) + " goals"', goals).value).toBe("3 goals");
    expect(ev('list({{goals}}) + " and more"', goals).value).toBe(
      "Sleep, Energy and Focus and more"
    );
  });

  it("decides on WHERE the bare word sits, not whether one exists", () => {
    // The two shapes the classifier has to tell apart, side by side. Both hold a
    // known stdlib name at a call site and a bare word somewhere; only the
    // position of the bare word distinguishes them. A bare identifier is never a
    // legal argument, so one INSIDE the parens proves they are punctuation
    // ("min" is short for minutes); one OUTSIDE proves nothing about the call.
    const warn = warnSpy();
    expect(ev("{{n}} min(s) left", { n: { value: "3", kind: "int" } }).value).toBe("3 min(s) left");
    expect(ev("{{n}} max(s)", { n: { value: "3", kind: "int" } }).value).toBe("3 max(s)");
    // Tokenizes cleanly (no `.`), so this one really does go through the
    // classifier rather than failing to lex: the known `round` call site is
    // disqualified by the bare `up` between its parens.
    expect(ev("Total (before round(up))").value).toBe("Total (before round(up))");
    expect(warn).not.toHaveBeenCalled();
    // Same names, arguments that ARE arguments: a call, and a loud failure.
    expect(ev("min({{n}}, 2) minutes", { n: { value: "3", kind: "int" } }).value).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("expression stdlib — the name set is the dispatch table", () => {
  const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  // `STDLIB_NAMES` gates BOTH `callFunction`'s dispatch and `isCallAttempt`'s
  // prose classification, so a name can only be in one of the two places by
  // being in neither. These two tests pin one direction each: a name missing
  // from the set is not callable, and a name missing from the switch is not
  // reported loudly. Add a function, add it to both tables here.
  const validCalls: Record<string, string> = {
    min: "min(1, 2)",
    max: "max(1, 2)",
    abs: "abs(0 - 1)",
    round: "round(1.4)",
    clamp: "clamp(5, 1, 3)",
    addDays: 'format(addDays("now", 1), "medium", "en-US")',
    format: 'format("now", "medium", "en-US")',
    list: "list({{goals}})",
    join: "join({{goals}})",
    count: "count({{goals}})",
    plural: 'plural(1, "day", "days")',
  };

  it("dispatches every documented name", () => {
    const warn = warnSpy();
    for (const [name, template] of Object.entries(validCalls)) {
      expect(ev(template, goals).value, name).not.toBe("");
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("reports a misused documented name loudly, never as prose", () => {
    const warn = warnSpy();
    for (const name of Object.keys(validCalls)) {
      // Zero arguments is wrong for all of them, so each parse fails; the point
      // is that the failure is a warning and an empty string rather than the
      // source text interpolated back into the variable.
      expect(ev(`${name}()`, goals).value, name).toBe("");
    }
    expect(warn).toHaveBeenCalledTimes(Object.keys(validCalls).length);
  });
});

describe("expression stdlib — string literals interpolate", () => {
  it("interpolates a quoted literal's contents", () => {
    // Review finding on #243. The literal used to be returned verbatim, so a
    // fully quoted template stored its own source text with no warning.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev('"{{name}}"', { name: { value: "Ada" } })).toEqual({
      value: "Ada",
      kind: "string",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("interpolates a literal concatenated onto a call result", () => {
    // The advertised sentence-assembly shape. Without this the braces reach the
    // user: the variable would hold "Sleep, Energy and Focus for {{name}}".
    expect(ev('list({{goals}}) + " for {{name}}"', {
      ...goals,
      name: { value: "Ada" },
    }).value).toBe("Sleep, Energy and Focus for Ada");
  });

  it("leaves a literal with no reference in it byte-identical", () => {
    expect(ev('join({{goals}}, " · ")', goals).value).toBe("Sleep · Energy · Focus");
    expect(ev('format({{d}}, "medium", "en-US")', {
      d: { value: "2026-03-04T12:00:00.000Z" },
    }).value).toBe("Mar 4, 2026");
  });
});

describe("expression stdlib — unsplittable member labels", () => {
  it("warns when the joined label cannot be split back onto its values", () => {
    // CheckboxGroup writes `label` as the ", "-joined member labels, so a member
    // label that itself contains ", " makes the split ambiguous and the raw
    // values are the only safe source. That is a machine key in user-facing
    // prose, so it must not be silent — same rule as every other believable
    // wrong answer in this module.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("list({{g}})", {
      g: { value: '["a","b"]', label: "Sleep, better, Energy" },
    }).value).toBe("a and b");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("label");
  });

  it("does not warn when the arity matches", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ev("list({{goals}})", goals).value).toBe("Sleep, Energy and Focus");
    expect(ev("list({{g}})", { g: { value: '["sleep"]' } }).value).toBe("sleep");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("expression stdlib — an unseeded variable is data, never configuration", () => {
  // `missing: true` is the documented numeric-0 sentinel for an absent
  // variable (`expression.ts:22-24`), and it is deliberate: it is what makes
  // increment-before-seed arithmetic and `count()` on a skipped screen work.
  // But a bound and a digit count are not data, they are CONFIGURATION, and an
  // unseeded one means the author referenced a variable that does not exist.
  // Answering from the sentinel there turns a typo into a plausible constant.
  const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("clamp refuses bounds that are unseeded variables", () => {
    const warn = warnSpy();
    // Both bounds resolved to 0, `0 > 0` is false so the range check passed,
    // and a legitimate 42 came back as "0" with NO warning at all.
    expect(
      ev("clamp({{score}}, {{floor}}, {{ceiling}})", { score: { value: "42", kind: "int" } })
    ).toEqual({ value: "", kind: "string" });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("clamp refuses a single unseeded bound as a bound, not as an inverted range", () => {
    warnSpy();
    const score: Vars = { score: { value: "42", kind: "int" } };
    expect(ev("clamp({{score}}, 1, {{ceiling}})", score).value).toBe("");
    expect(ev("clamp({{score}}, {{floor}}, 3)", score).value).toBe("");
  });

  it("round refuses an unseeded digit count instead of rounding to whole numbers", () => {
    warnSpy();
    // `round(42.75, {{typo}})` silently became `round(42.75, 0)` -> 43.
    expect(ev("round(42.75, {{digits}})").value).toBe("");
    // The seeded case is untouched.
    expect(ev("round(42.75, 1)")).toEqual({ value: "42.8", kind: "float" });
  });

  it("still reads an unseeded variable as 0 everywhere it is DATA", () => {
    expect(ev("{{counter}} + 1")).toEqual({ value: "1", kind: "int" });
    expect(ev("count({{never_answered}})")).toEqual({ value: "0", kind: "int" });
    // The clamp INPUT is data: a counter nobody has touched yet clamps to its
    // floor, which is the same answer it will give after the first press.
    expect(ev("clamp({{unset}}, 1, 3)")).toEqual({ value: "1", kind: "int" });
    expect(ev("min({{unset}}, 5)")).toEqual({ value: "0", kind: "int" });
  });
});
