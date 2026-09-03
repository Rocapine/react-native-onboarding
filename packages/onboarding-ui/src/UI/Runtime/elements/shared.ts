import React from "react";
import { CustomActions, ProductRuntime } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { Theme } from "../../Theme/types";
import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";
import type { BaseBoxProps } from "./BaseBoxProps";
import type { CompleteOutcome } from "../ScreenHost";

/**
 * The container an element is being laid out by. Declared here — the leaf
 * module with no `react-native` import — so the wrapper-layout split and the
 * renderers share one definition instead of hand-copying the union.
 */
export type ParentType = "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";

export type RenderContext = {
  theme: Theme;
  // Live read of the merged variable map (elementDefaults ⊕ composableVariables)
  // for press-time action evaluation (runActions). Stable identity backed by a
  // ref in the Renderer, so onPress handlers read the LATEST values without the
  // ctx (and every memoized element holding it) changing on each write. Reactive
  // reads for rendering go through `useVariables()` (VariablesContext), NOT here.
  getVariables: () => Record<string, ComposableVariableEntry>;
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  // "The continue action fired" — mapped 1:1 to `host.complete` by
  // ScreenRenderer (see the ScreenHost seam note). The optional outcome is how
  // a `"dismiss"` action forwards `{ status: "dismissed" }` through the same
  // channel; "continue" itself calls this with no argument.
  onContinue: (outcome?: CompleteOutcome) => void;
  customActions: CustomActions;
  /** Product runtime for `purchase` / `restore` actions. Undefined without billing. */
  products?: ProductRuntime;
  /** Host capability for the `presentPaywall` action. Undefined without one. */
  presentPaywall?: (placement: string) => void;
  /**
   * Render child elements. `ctxOverride` renders them against a DERIVED context
   * instead of the screen's root one — `Repeat` uses it to give each
   * materialized row its own `getVariables`, so a press-time action inside a row
   * resolves that row's `{{item.*}}` values. Omit it everywhere else.
   */
  renderChildren: (
    elements: UIElement[],
    parentType: ParentType,
    ctxOverride?: RenderContext
  ) => React.ReactNode;
};

// Shared `React.memo` comparator for element components. `element` is
// referentially stable (from the memoized parsed step), `parentType` is a string,
// and `ctx` is stable across variable writes (it changes only on a theme switch),
// so this skips re-render on every write. Variable-reading components additionally
// subscribe via `useVariables()`, which re-renders them regardless of this
// comparator (context propagation bypasses React.memo).
export const areElementPropsEqual = (
  a: { element: unknown; parentType?: unknown; ctx?: unknown },
  b: { element: unknown; parentType?: unknown; ctx?: unknown }
): boolean =>
  a.element === b.element && a.parentType === b.parentType && a.ctx === b.ctx;

// Text-style defaults a `RichText` container hands down to its child `Text`
// elements. A `<View>` doesn't propagate text style to nested `<Text>`, so the
// RichText renderer publishes these via context and the Text element renderer
// (PlainText/ExpressionText) merges them under its own props (child always wins).
// Empty default ({}) means
// Text elements outside a RichText behave unchanged.
export type InheritedTextStyle = {
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export const RichTextStyleContext = React.createContext<InheritedTextStyle>({});

export const interpolate = (template: string, variables: Record<string, ComposableVariableEntry>): string =>
  template.replace(/\{\{([^}]+?)\}\}/g, (_, key) => variables[key]?.label ?? variables[key]?.value ?? "");

// Same `{{var}}` substitution as `interpolate`, but reads `value` BEFORE
// `label` — the inverse precedence. `interpolate` favors `label` because it
// exists for DISPLAY text (`Text.content`, a `{{var}}` inside a Button label
// if that ever grows interpolation) — a human-readable string is exactly what
// a label is for. Machine identifiers are the opposite case: a product slot
// key is constrained by the studio to `^[a-z][a-z0-9_]{0,63}$`, and a display
// label (e.g. "Yearly") will essentially never satisfy that shape, so `value`
// is the correct source and `label` is only a same-string fallback for a
// variable that happens to carry no `value`. Use this wherever a `{{var}}`
// reference is resolved as an IDENTIFIER to look up, not shown to the user —
// today that's `purchase`'s `product` field (`runActions.ts`); reach for it
// again for any future identifier-shaped resolution rather than `interpolate`.
export const interpolateIdentifier = (template: string, variables: Record<string, ComposableVariableEntry>): string =>
  template.replace(/\{\{([^}]+?)\}\}/g, (_, key) => variables[key]?.value ?? variables[key]?.label ?? "");

// Cast number | string dimension values to DimensionValue for React Native style props
export const dim = (v: number | string | undefined): import("react-native").DimensionValue | undefined =>
  v as import("react-native").DimensionValue | undefined;

// Build a RN shadow style with sensible iOS defaults. iOS defaults
// `shadowOpacity` to 0 and `shadowRadius` to 0, so an author setting only
// `shadowColor` would see no shadow. Fill in 1 / 4 when those are unset.
// Android shadows go through `elevation` independently.
export type ShadowStyleInput = Pick<
  BaseBoxProps,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;
export const buildShadowStyle = (p: ShadowStyleInput) => {
  const hasShadow = p.shadowColor != null;
  return {
    shadowColor: p.shadowColor,
    shadowOffset: p.shadowOffset,
    shadowOpacity: p.shadowOpacity ?? (hasShadow ? 1 : undefined),
    shadowRadius: p.shadowRadius ?? (hasShadow ? 4 : undefined),
    elevation: p.elevation,
  };
};

// Resolve element fontFamily against theme `typography.defaultFontFamily`.
// Returns the theme default when the element provides no usable font — i.e. it
// omits fontFamily (`undefined`), sets it to `"inherit"`, or leaves it empty
// (`""` / `null`). The CMS emits an empty string / null for "no font selected",
// so those must fall back to the configured default too — otherwise a falsy
// family reaches `resolveFontFamily`, which returns `undefined` (system font)
// and silently ignores the theme default.
export const resolveInheritedFontFamily = (
  elementFontFamily: string | null | undefined,
  themeDefault: string | undefined
): string | undefined => {
  if (!elementFontFamily || elementFontFamily === "inherit") {
    return themeDefault;
  }
  return elementFontFamily;
};
