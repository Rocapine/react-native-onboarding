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
