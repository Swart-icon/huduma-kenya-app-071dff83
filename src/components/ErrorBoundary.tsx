import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log to console in dev, could send to monitoring service in prod
    console.error("[ErrorBoundary] Uncaught error:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <Card className="max-w-sm w-full border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                An unexpected error occurred. Please try again or go back to the dashboard.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="bg-muted rounded-xl p-3 mb-4 text-left">
                  <p className="text-xs font-mono text-destructive break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1 rounded-xl h-11"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="flex-1 rounded-xl h-11"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
