import React from 'react'

export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RootErrorBoundary] Unhandled application error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleReset = () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.clear()
        const keysToRemove = [
          'career_gps_report_data',
          'career_gps_user_id',
          'career_gps_email',
          'career_gps_form_data',
          'career_gps_is_verified',
        ]
        keysToRemove.forEach((k) => localStorage.removeItem(k))
        window.location.href = '/'
      }
    } catch (_e) {
      window.location.href = '/'
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Crafture Career GPS
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                An unexpected interface issue occurred. Your saved progress is preserved.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="py-2.5 px-5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg cursor-pointer"
              >
                Refresh Page
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="py-2.5 px-5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-sm font-medium text-slate-200 transition-colors cursor-pointer"
              >
                Restart Session
              </button>
            </div>

            <div className="pt-2 text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline cursor-pointer"
              >
                {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] font-mono text-rose-300 max-h-48 overflow-y-auto text-left leading-normal">
                  <div className="font-bold mb-1">
                    {this.state.error?.name}: {this.state.error?.message}
                  </div>
                  {this.state.error?.stack && (
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

