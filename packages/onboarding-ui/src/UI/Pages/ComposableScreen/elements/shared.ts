import React from "react";
import { CustomActions } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { Theme } from "../../../Theme/types";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";
import type { BaseBoxProps } from "./BaseBoxProps";

export type RenderContext = {
  theme: Theme;
  variables: Record<string, ComposableVariableEntry>;
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  onContinue: () => void;
  customActions: CustomActions;
  renderChildren: (elements: UIElement[], parentType: "XStack" | "YStack" | "ZStack") => React.ReactNode;
};

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
// Returns the theme default when element omits fontFamily or sets it to "inherit".
export const resolveInheritedFontFamily = (
  elementFontFamily: string | undefined,
  themeDefault: string | undefined
): string | undefined => {
  if (elementFontFamily === undefined || elementFontFamily === "inherit") {
    return themeDefault;
  }
  return elementFontFamily;
};
