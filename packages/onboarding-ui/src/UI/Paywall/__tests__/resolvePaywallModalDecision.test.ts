import { describe, it, expect } from "vitest";
import {
  describePaywallParseError,
  resolvePaywallModalDecision,
} from "../resolvePaywallModalDecision";

type FakeElements = { ok: true };

const succeed = (elements: unknown) => ({ success: true as const, data: elements as FakeElements });
const fail = () => ({ success: false as const, error: { issues: [{ path: ["0", "props", "variant"], message: "invalid_enum_value" }] } });

describe("resolvePaywallModalDecision", () => {
  it("is 'hidden' when there is no active paywall", () => {
    const decision = resolvePaywallModalDecision(null, succeed);
    expect(decision).toEqual({ type: "hidden" });
  });

  it("is 'show' with the parsed elements when parsing succeeds", () => {
    const paywall = { elements: [{ type: "Text" }] };
    const decision = resolvePaywallModalDecision(paywall, succeed);
    expect(decision).toEqual({ type: "show", elements: paywall.elements });
  });

  it("is 'parse-error' — never 'show' — when parsing fails", () => {
    // Finding 2: a malformed payload must never reach the Modal/ErrorBoundary
    // path, which has no interactive control and would trap an iOS user.
    const paywall = { elements: [{ type: "NotAnElement" }] };
    const decision = resolvePaywallModalDecision(paywall, fail);
    expect(decision.type).toBe("parse-error");
  });

  it("CARRIES the validation error so the host can log which prop is wrong", () => {
    // The whole reason this field exists: the decision used to keep only
    // `success` and throw the issues away, so a paywall that could never
    // render reported a bare "error" with nothing naming the offending prop.
    // A real case cost two multi-hour investigations to identify by
    // elimination as a Button `variant` outside filled|outlined|ghost.
    const paywall = { elements: [{ type: "Button" }] };
    const decision = resolvePaywallModalDecision(paywall, fail);
    expect(decision).toEqual({ type: "parse-error", error: fail().error });
  });

  it("tolerates a parser that reports failure without an error object", () => {
    const decision = resolvePaywallModalDecision({ elements: [] }, () => ({ success: false as const }));
    expect(decision).toEqual({ type: "parse-error", error: undefined });
  });

  it("calls parse with the active paywall's own elements", () => {
    const paywall = { elements: ["marker"] };
    let received: unknown;
    resolvePaywallModalDecision(paywall, (elements) => {
      received = elements;
      return succeed(elements);
    });
    expect(received).toBe(paywall.elements);
  });
});

describe("resolvePaywallModalDecision: custom-screen paywalls", () => {
  const Screen = () => null;
  const screens = { "paywall-native-v2": Screen };

  it("is 'show-custom' with the registered component when renderMode is custom", () => {
    const paywall = {
      elements: [],
      renderMode: "custom" as const,
      customScreenId: "paywall-native-v2",
      customPayload: { monthly: { ios: "com.app.m" } },
    };
    expect(resolvePaywallModalDecision(paywall, succeed, screens)).toEqual({
      type: "show-custom",
      Screen,
      customScreenId: "paywall-native-v2",
      payload: { monthly: { ios: "com.app.m" } },
    });
  });

  // The whole point of skipping rather than short-circuiting: an author who
  // flips a paywall to custom mode may leave an element tree behind, and it
  // must not be parsed (let alone rendered) on the way past.
  it("NEVER invokes the parser in custom mode, even with elements present", () => {
    let called = 0;
    resolvePaywallModalDecision(
      {
        elements: [{ type: "Text" }],
        renderMode: "custom" as const,
        customScreenId: "paywall-native-v2",
      },
      (elements) => {
        called += 1;
        return succeed(elements);
      },
      screens,
    );
    expect(called).toBe(0);
  });

  // A host wiring bug, not a CMS data bug — the two have opposite fixes, which
  // is why this is its own decision (and its own PresentErrorReason) rather
  // than being folded into "parse-error".
  it("is 'unknown-custom-screen' when the id is not registered", () => {
    const paywall = {
      elements: [],
      renderMode: "custom" as const,
      customScreenId: "paywall-not-registered",
    };
    expect(resolvePaywallModalDecision(paywall, succeed, screens)).toEqual({
      type: "unknown-custom-screen",
      customScreenId: "paywall-not-registered",
    });
  });

  it("is 'unknown-custom-screen' when no customScreens map was passed at all", () => {
    const paywall = {
      elements: [],
      renderMode: "custom" as const,
      customScreenId: "paywall-native-v2",
    };
    expect(resolvePaywallModalDecision(paywall, succeed).type).toBe("unknown-custom-screen");
  });

  // An empty or absent screen id cannot match a registration, and the studio
  // accepts one (it warns rather than refusing) — so this is a reachable state,
  // not a defensive branch.
  it("is 'unknown-custom-screen' for a blank or absent screen id", () => {
    for (const customScreenId of ["", "   ", undefined, null]) {
      const decision = resolvePaywallModalDecision(
        { elements: [], renderMode: "custom" as const, customScreenId },
        succeed,
        screens,
      );
      expect(decision.type, `for ${JSON.stringify(customScreenId)}`).toBe("unknown-custom-screen");
    }
  });

  it("trims the screen id before looking it up", () => {
    const decision = resolvePaywallModalDecision(
      { elements: [], renderMode: "custom" as const, customScreenId: " paywall-native-v2 " },
      succeed,
      screens,
    );
    expect(decision).toMatchObject({ type: "show-custom", Screen });
  });

  // The screen must never receive `undefined` for the one prop it exists to
  // read. An older get-paywalls sends no customPayload at all.
  it("defaults an absent customPayload to an empty map", () => {
    const decision = resolvePaywallModalDecision(
      { elements: [], renderMode: "custom" as const, customScreenId: "paywall-native-v2" },
      succeed,
      screens,
    );
    expect(decision).toMatchObject({ type: "show-custom", payload: {} });
  });

  // A device on a new SDK can hit an older get-paywalls that sends no
  // renderMode, and absent must read as "elements" — not as a broken custom
  // paywall.
  it("treats an absent renderMode as elements, even when customScreens are registered", () => {
    const paywall = { elements: [{ type: "Text" }] };
    expect(resolvePaywallModalDecision(paywall, succeed, screens)).toEqual({
      type: "show",
      elements: paywall.elements,
    });
  });

  it("leaves an explicit elements-mode paywall on the element path", () => {
    const paywall = {
      elements: [{ type: "Text" }],
      renderMode: "elements" as const,
      // Present but irrelevant — flipping back to elements does not destroy
      // these, so a live paywall can legitimately carry both.
      customScreenId: "paywall-native-v2",
      customPayload: { monthly: { ios: "com.app.m" } },
    };
    expect(resolvePaywallModalDecision(paywall, succeed, screens)).toEqual({
      type: "show",
      elements: paywall.elements,
    });
  });

  it("is still 'hidden' with no active paywall, whatever is registered", () => {
    expect(resolvePaywallModalDecision(null, succeed, screens)).toEqual({ type: "hidden" });
  });
});

describe("describePaywallParseError", () => {
  // Zod v4 shape: a union issue carries `errors: Issue[][]`, one entry per
  // variant, and nests. The element schema is a 26-member union of unions, so
  // the top-level issue is ALWAYS `invalid_union` / "Invalid input" at the
  // array index — reporting only that prints `0: Invalid input`, which is no
  // better than the discarded error this replaced.
  const unionIssue = (path: unknown[], branches: unknown[][]) => ({
    code: "invalid_union",
    path,
    message: "Invalid input",
    errors: branches,
  });

  it("recurses into nested union branches and accumulates the full path", () => {
    const error = {
      issues: [
        unionIssue([0], [
          [unionIssue(["props"], [[{ path: ["variant"], message: "Invalid option" }]])],
        ]),
      ],
    };
    expect(describePaywallParseError(error)).toContain("0.props.variant");
  });

  it("also handles zod v3's `unionErrors` (ZodError[]) shape", () => {
    // The parser is injected, so its zod major is not ours to assume.
    const error = {
      issues: [
        {
          code: "invalid_union",
          path: [2],
          message: "Invalid input",
          unionErrors: [{ issues: [{ path: ["props", "label"], message: "Required" }] }],
        },
      ],
    };
    expect(describePaywallParseError(error)).toContain("2.props.label: Required");
  });

  it("reports the value the author actually wrote at the failing path", () => {
    const elements = [{ type: "Button", props: { variant: "plain" } }];
    const error = {
      issues: [
        unionIssue([0], [[{ path: ["props", "variant"], message: "Invalid option" }]]),
      ],
    };
    expect(describePaywallParseError(error, elements)).toBe(
      '0.props.variant: Invalid option (authored value: "plain")'
    );
  });

  it("ranks a prop the author WROTE above missing-prop noise from non-matching variants", () => {
    // The real production failure. A Button with an invalid `variant` makes the
    // 26-variant union also complain that Text's `content`, Image's `url` etc.
    // are missing — same depth, so depth alone drowned the real cause. Only the
    // invalid `variant` corresponds to something actually authored.
    const elements = [{ type: "Button", props: { variant: "plain" } }];
    const error = {
      issues: [
        unionIssue([0], [
          [{ path: ["props", "content"], message: "expected string, received undefined" }],
          [{ path: ["props", "url"], message: "expected string, received undefined" }],
          [{ path: ["props", "variant"], message: 'expected one of "filled"|"outlined"|"ghost"' }],
        ]),
      ],
    };
    const message = describePaywallParseError(error, elements);
    expect(message.startsWith("0.props.variant")).toBe(true);
    expect(message).toContain('"plain"');
  });

  it("caps the report so a deep union cannot produce an unreadable wall of text", () => {
    const branches = Array.from({ length: 30 }, (_, i) => [
      { path: ["props", `p${i}`], message: "nope" },
    ]);
    const message = describePaywallParseError({ issues: [unionIssue([0], branches)] });
    expect(message.split("; ")).toHaveLength(3);
  });

  it("reports a root-level issue with no path", () => {
    expect(describePaywallParseError({ issues: [{ path: [], message: "Expected array" }] })).toBe(
      "(root): Expected array"
    );
  });

  // Defensive cases: the parser is injected, so `error` is a ZodError only by
  // convention. A diagnostic that throws would restore the silence it fixes.
  it("does not throw on an error with no issue list", () => {
    expect(describePaywallParseError({ weird: true })).toBe('{"weird":true}');
  });

  it("does not throw on a string, null or undefined error", () => {
    expect(describePaywallParseError("boom")).toBe("boom");
    expect(describePaywallParseError(null)).toBe("null");
    expect(describePaywallParseError(undefined)).toBe("null");
  });
});
