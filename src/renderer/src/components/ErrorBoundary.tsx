import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useT } from '@/lib/settings'
import { Button } from './ui'

/**
 * Keeps a crash in one screen from blanking the whole window. The sidebar
 * stays usable, so the user can retry or move to another tool.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <Fallback error={this.state.error} onRetry={() => this.setState({ error: null })} />
  }
}

function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const t = useT()
  return (
    <div className="flex h-full items-center justify-center" role="alert">
      <div className="max-w-[440px] text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-coral/15 text-coral">
          <CircleAlert size={22} />
        </span>
        <h1 className="font-display text-2xl font-semibold">{t('Something went wrong')}</h1>
        <p className="mt-2 text-faded">{t('This screen hit an unexpected error. Your files are not affected.')}</p>
        <p className="mt-4 select-text break-words rounded-lg border border-line bg-ink/60 px-3 py-2 font-mono text-xs text-dim">
          {error.message}
        </p>
        <Button variant="primary" className="mt-6" icon={<RotateCcw size={15} />} onClick={onRetry}>
          {t('Try again')}
        </Button>
      </div>
    </div>
  )
}
