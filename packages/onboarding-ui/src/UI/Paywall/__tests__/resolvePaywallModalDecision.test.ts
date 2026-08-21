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
