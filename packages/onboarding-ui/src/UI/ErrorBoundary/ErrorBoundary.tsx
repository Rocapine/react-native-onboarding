import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ZodError } from 'zod';

interface ErrorBoundaryProps {
  children: ReactNode;
  stepType?: string;
  /**
   * Called once, right after `componentDidCatch`, with the error that was
   * caught. Optional — every existing caller of `withErrorBoundary` that
   * doesn't need this keeps working unchanged.
   *
   * N4, 2026-08-18 final review round 2: `PaywallHost` passes one that calls
   * `complete({status:"error"})` — a render-time crash the Finding 2 parse
   * check cannot predict (an element renderer throwing on valid-but-unusual
   * props) would otherwise still render this boundary's fallback — which has
   * no interactive control — inside a fullScreen, non-transparent Modal, with
   * the pending `present()` promise never settling. This callback closes that
   * remaining trap symmetrically with Finding 2's fix, without adding any UI
   * (so it cannot collide with an authored paywall's own design) and without
   * changing the fallback rendered below, which the onboarding host still
   * relies on as-is (a back button already exists OUTSIDE that boundary
   * there).
   */
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  formatZodError(error: ZodError<any>): string {
    try {
      // Zod 4 renamed `ZodError.errors` to `.issues` — `.errors` no longer
      // exists, so this used to throw on every call and fall through to the
      // catch below, always rendering the fallback string instead of the
      // real validation detail.
      return error.issues
        .map((err) => {
          const path = err.path.join(' > ');
          return `• ${path || 'root'}: ${err.message}`;
        })
        .join('\n');
    } catch (error) {
      console.error('Error formatting Zod error:', error);
      return 'An error occurred while formatting the Zod error';
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const isZodError = this.state.error instanceof ZodError;
      const { stepType } = this.props;

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>
              {isZodError ? 'Invalid Step Payload' : 'Something went wrong'}
            </Text>

            {stepType && (
              <Text style={styles.stepType}>Step Type: {stepType}</Text>
            )}

            <ScrollView style={styles.errorScroll} contentContainerStyle={styles.errorScrollContent}>
              {isZodError ? (
                <View style={styles.errorSection}>
                  <Text style={styles.errorLabel}>Validation Errors:</Text>
                  <Text style={styles.errorMessage}>
                    {this.formatZodError(this.state.error as ZodError<any>)}
                  </Text>
                </View>
              ) : (
                <View style={styles.errorSection}>
                  <Text style={styles.errorLabel}>Error Message:</Text>
                  <Text style={styles.errorMessage}>
                    {this.state.error.message}
                  </Text>
                  {this.state.error.stack && (
                    <>
                      <Text style={styles.errorLabel}>Stack Trace:</Text>
                      <Text style={styles.errorStack}>
                        {this.state.error.stack}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            {isZodError && (
              <View style={styles.hint}>
                <Text style={styles.hintText}>
                  💡 Check the step payload structure and ensure all required fields match the schema.
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorScroll: {
    maxHeight: 400,
    width: '100%',
  },
  errorScrollContent: {
    paddingVertical: 16,
  },
  errorSection: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#7f1d1d',
    fontFamily: 'Courier',
    lineHeight: 20,
  },
  errorStack: {
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'Courier',
    lineHeight: 16,
    marginTop: 8,
  },
  hint: {
    marginTop: 24,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  hintText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});
