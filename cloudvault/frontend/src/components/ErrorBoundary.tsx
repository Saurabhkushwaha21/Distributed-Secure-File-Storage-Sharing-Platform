import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send this to an error-tracking service (Sentry, etc.)
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
          <h1 className="font-display text-2xl text-ink">Something broke on our end</h1>
          <p className="max-w-md text-sm text-steel">
            The page hit an unexpected error. Your files are untouched — reloading usually fixes this.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-dark"
          >
            Reload CloudVault
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
