import type { ComposableVariableEntry, ComposableVariableKind } from "@rocapine/react-native-onboarding";
import { interpolate } from "./shared";

type Token =
  | { kind: "num"; value: number; isInt: boolean }
  | { kind: "var"; name: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "eof" };

type Value =
  | { kind: "number"; n: number; isInt: boolean }
  | { kind: "string"; s: string };

const isDigit = (c: string) => c >= "0" && c <= "9";
const isSpace = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

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
  if (!entry) return { kind: "number", n: 0, isInt: true };
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
  // No kind tag — infer from string content.
  const trimmed = raw.trim();
  if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (Number.isFinite(n)) return { kind: "number", n, isInt: Number.isInteger(n) && !trimmed.includes(".") };
  }
  return { kind: "string", s: raw };
}

function valueToString(v: Value): string {
  if (v.kind === "string") return v.s;
  if (v.isInt) return Math.trunc(v.n).toString();
  return v.n.toString();
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
      return { kind: "number", n: -v.n, isInt: v.isInt };
    }
    if (t.kind === "num") {
      advance();
      return { kind: "number", n: t.value, isInt: t.isInt };
    }
    if (t.kind === "var") {
      advance();
      return resolveVar(t.name, vars);
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
 * Accepts `{{var}}` references, numeric literals (int / float), `+ - * /` and
 * parentheses. Variable values are coerced according to their `kind` tag
 * (string / int / float), or inferred from their string content when no tag
 * is present. `+` on any non-numeric operand becomes string concat.
 *
 * On any parse or evaluation failure, falls back to plain interpolation
 * (existing `interpolate()` semantics, returns a string).
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
      return { value: result.s, kind: "string" };
    }
  }
  return { value: interpolate(template, vars), kind: "string" };
}
