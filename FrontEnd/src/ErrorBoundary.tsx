import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from './services/errorsService';

// Composition-root infrastructure, not a `ui/` primitive (calls services/errorsService.ts,
// failing AD-3's `ui/` test) and not a feature -- lives at src/ top level, mounted once from
// main.tsx. Must be a class component: React Error Boundaries require componentDidCatch/
// getDerivedStateFromError, which function components cannot implement.
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // This project has no @types/react installed -- TS infers React's types from its plain-JS
  // source (allowJs), which doesn't surface Component's generic props/state fields the way a
  // real .d.ts would. `declare` restates their type with no runtime effect (the real
  // React.Component constructor already assigns `this.props`).
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    // Code-review patch: React passes through whatever a child actually threw at runtime -- a
    // string, a plain object, etc. -- regardless of this parameter's `Error` type. Coercing a
    // non-Error value keeps `message` populated instead of `undefined`, which JSON.stringify
    // would otherwise drop from the report payload entirely.
    const normalized = error instanceof Error ? error : new Error(String(error));
    void reportError({
      message: normalized.message,
      stack: normalized.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Something went wrong.</h1>
          <p className="text-slate-500">Please reload the page. If the problem continues, contact support.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
