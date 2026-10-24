import React from 'react'
import { WarningCircle, ArrowsClockwise, FileText } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'

export default class ReportErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ReportErrorBoundary caught an unhandled render error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    try {
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (_e) {}
  }

  handleResetToSample = () => {
    try {
      useAppStore.getState().setReportData(null)
      this.setState({ hasError: false, error: null, errorInfo: null })
    } catch (_e) {
      window.location.reload()
    }
  }

  handleRetest = () => {
    try {
      useAppStore.getState().setPhase(PHASES.ASSESSMENT)
    } catch (_e) {
      window.location.href = '/'
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[var(--surface-card)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500">
              <WarningCircle size={36} weight="fill" />
            </div>

            <div className="space-y-2">
              <h2
                className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                Report Rendering Recovery
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                We encountered an unexpected formatting issue with the AI report output, but your assessment data has been safely preserved.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowsClockwise size={16} weight="bold" />
                <span>Retry Rendering</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetToSample}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-strong)] text-xs font-semibold text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText size={16} />
                <span>Load Sample Preview</span>
              </button>

              <button
                type="button"
                onClick={this.handleRetest}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-strong)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Edit Assessment</span>
              </button>
            </div>

            <div className="pt-2 text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline cursor-pointer"
              >
                {this.state.showDetails ? 'Hide technical diagnosis' : 'Show technical diagnosis'}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[11px] font-mono text-red-500 overflow-x-auto max-h-48 leading-relaxed">
                  <div>{this.state.error?.toString()}</div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-2 text-[10px] text-[var(--text-muted)] whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </div>
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
