import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  resetKey?: string | number | null;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? ` (${this.props.name})` : ''}] Caught error:`, error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Automatically reset error boundary if resetKey changes (e.g. user selected another event)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full my-4 p-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-md text-slate-800 dark:text-slate-100 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                {this.props.name ? `${this.props.name} failed to render` : 'Temporary Display Issue'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                An unexpected transitional error occurred while loading this incident view. Your other data remains safe.
              </p>
              {this.state.error?.message && (
                <div className="text-[11px] font-mono text-rose-700 dark:text-rose-300 bg-rose-500/15 rounded-lg px-2.5 py-1 mb-3 break-words max-w-xl">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reload Component</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
