import React, { useContext, useRef } from "react";
import type { SharedValue } from "react-native-reanimated";

// Screen-scoped registry of *animated* variables — the reanimated SharedValues
// that an autoplay ProgressIndicator sweeps on the UI thread.
//
// It exists to separate two kinds of "variable" that the composable system
// otherwise conflates:
//   • durable "concept" variables — persisted in the OnboardingProgress store,
//     drive branching / analytics / `{{var}}` text. Writing them re-renders every
//     store consumer, so an autoplay ProgressIndicator writes its bound variable
//     to the store ONLY at the sweep boundaries (0 / max) — the per-step
//     re-render-storm fix.
//   • ephemeral screen-animation state — the live sweep value. It changes ~60×/s
//     and only matters to a few `renderWhen`-gated siblings on the same screen.
//
// Publishing the sweep as a SharedValue here lets those gated siblings evaluate
// their threshold conditions from the live value on the UI thread (see
// `GatedElement`), so a stepped loader animates smoothly — WITHOUT touching the
// store, so the boundary-only write (and its perf win) is preserved.
//
// The registry object identity is stable for the screen's lifetime, so providing
// it via context never re-renders consumers; a registration is broadcast through
// per-name listeners instead.
export type AnimatedVariablesRegistry = {
  /** The live SharedValue for `name`, or undefined if no producer animates it. */
  get: (name: string) => SharedValue<number> | undefined;
  /** Called by an autoplay producer on mount. */
  register: (name: string, value: SharedValue<number>) => void;
  /** Called by the producer on unmount. */
  unregister: (name: string) => void;
  /** Subscribe to register/unregister of `name`; returns an unsubscribe fn. */
  subscribe: (name: string, listener: () => void) => () => void;
};

const noop = () => {};

const EMPTY: AnimatedVariablesRegistry = {
  get: () => undefined,
  register: noop,
  unregister: noop,
  subscribe: () => noop,
};

export const AnimatedVariablesContext = React.createContext<AnimatedVariablesRegistry>(EMPTY);

export const useAnimatedVariables = (): AnimatedVariablesRegistry => useContext(AnimatedVariablesContext);

// Build the stable per-screen registry. Held in a ref so its identity never
// changes across renders (mutations go through the closure, listeners handle
// notification) — the Renderer provides this value once and it never invalidates.
export const useAnimatedVariablesRegistry = (): AnimatedVariablesRegistry => {
  const ref = useRef<AnimatedVariablesRegistry | null>(null);
  if (ref.current === null) {
    const values = new Map<string, SharedValue<number>>();
    const listeners = new Map<string, Set<() => void>>();
    const notify = (name: string) => {
      const set = listeners.get(name);
      if (set) set.forEach((l) => l());
    };
    ref.current = {
      get: (name) => values.get(name),
      register: (name, value) => {
        values.set(name, value);
        notify(name);
      },
      unregister: (name) => {
        values.delete(name);
        notify(name);
      },
      subscribe: (name, listener) => {
        let set = listeners.get(name);
        if (!set) {
          set = new Set();
          listeners.set(name, set);
        }
        set.add(listener);
        return () => {
          set!.delete(listener);
          if (set!.size === 0) listeners.delete(name);
        };
      },
    };
  }
  return ref.current;
};
