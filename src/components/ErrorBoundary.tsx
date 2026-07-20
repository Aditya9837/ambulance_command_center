import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component boundary:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="p-6 bg-slate-900 border border-red-900/50 rounded-xl max-w-lg mx-auto my-12 text-center text-slate-100 shadow-2xl">
          <div className="w-16 h-16 bg-red-950/50 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 mb-6">
            The application encountered an error while rendering this component. You can try refreshing the page or navigating back.
          </p>
          {this.state.error && (
            <div className="text-left text-xs bg-slate-950 p-4 rounded-lg overflow-x-auto font-mono text-red-400 border border-slate-800 max-h-48 mb-6">
              {this.state.error.toString()}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-medium rounded-lg text-sm transition-colors cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
