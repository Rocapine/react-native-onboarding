import React, { useContext } from "react";
import type { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";

// Reactive variable slice, split out of the (otherwise stable) RenderContext so
// that only components reading variables re-render on a write. The stable ctx is
// passed as a prop and compared by identity (see `areElementPropsEqual`); the
// volatile variable maps travel through this context instead, and components that
// need them call `useVariables()`. A variable write changes this context value
// and re-renders ONLY its consumers — memoized non-consumers are skipped, even
// though their memoized ancestors do not re-render (context bypasses React.memo).
export type VariablesContextValue = {
  variables: Record<string, ComposableVariableEntry>;
  // Variables flattened to primitives (entry.value) for renderWhen /
  // evaluateCondition checks. Memoized once per write in the Renderer.
  flatVariables: Record<string, unknown>;
};

const EMPTY: VariablesContextValue = { variables: {}, flatVariables: {} };

export const VariablesContext = React.createContext<VariablesContextValue>(EMPTY);

export const useVariables = (): VariablesContextValue => useContext(VariablesContext);
