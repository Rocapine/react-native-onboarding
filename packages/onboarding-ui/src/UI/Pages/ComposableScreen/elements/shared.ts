import React from "react";
import { CustomActions } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { Theme } from "../../../Theme/types";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";
import type { BaseBoxProps } from "./BaseBoxProps";

export type RenderContext = {
  theme: Theme;
  // Live read of the merged variable map (elementDefaults ⊕ composableVariables)
  // for press-time action evaluation (runActions). Stable identity backed by a
  // ref in the Renderer, so onPress handlers read the LATEST values without the
  // ctx (and every memoized element holding it) changing on each write. Reactive
  // reads for rendering go through `useVariables()` (VariablesContext), NOT here.
  getVariables: () => Record<string, ComposableVariableEntry>;
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  onContinue: () => void;
  customActions: CustomActions;
  renderChildren: (elements: UIElement[], parentType: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll") => React.ReactNode;
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
