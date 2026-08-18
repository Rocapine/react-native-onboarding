import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * `onError` is accepted as an extra, OPTIONAL prop on the wrapped component —
 * additive, so every existing caller that doesn't pass it is unaffected. It
 * is pulled off `props` before forwarding the rest to `Component`, so the
 * wrapped component itself never sees it (N4, 2026-08-18 final review round
 * 2 — see `ErrorBoundary.tsx`'s doc on the field for why `PaywallHost` needs
 * it). Per-instance rather than baked in at `stepType`'s wrap-time position:
 * `withErrorBoundary(Component, stepType)` runs once at module load, before
 * any host-specific callback (e.g. `complete`) exists to close over.
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  stepType?: string
) {
  const WrappedComponent = (props: P & { onError?: (error: Error) => void }) => {
    const { onError, ...rest } = props;
    return (
      <ErrorBoundary stepType={stepType} onError={onError}>
        <Component {...(rest as P)} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
