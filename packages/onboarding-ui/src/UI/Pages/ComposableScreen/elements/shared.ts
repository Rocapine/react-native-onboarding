import React from "react";
import { UIElement } from "../types";
import { Theme } from "../../../Theme/types";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";

export type RenderContext = {
  theme: Theme;
  variables: Record<string, ComposableVariableEntry>;
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  onContinue: () => void;
  renderChildren: (elements: UIElement[], parentType: "XStack" | "YStack") => React.ReactNode;
};

export const interpolate = (template: string, variables: Record<string, ComposableVariableEntry>): string =>
  template.replace(/\{\{([^}]+?)\}\}/g, (_, key) => variables[key]?.label ?? variables[key]?.value ?? "");
