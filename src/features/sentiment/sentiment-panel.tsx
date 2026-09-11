import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLinkIcon, SparklesIcon } from 'lucide-react'
import { ApiError, type Sentiment, type SentimentOut } from '@/lib/api'
import { useSentiment, useSentimentStatus } from '@/lib/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

export const SENTIMENT_LABELS: Record<Sentiment, string> = { bullish: 'Bullish', neutral: 'Neutral', bearish: 'Bearish' }

const SENTIMENT_CLASS: Record<Sentiment, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  neutral: 'bg-muted text-muted-foreground',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

export function SentimentBadge({ sentiment, className }: { sentiment: Sentiment; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(SENTIMENT_CLASS[sentiment], className)} data-testid="sentiment-badge">
      {SENTIMENT_LABELS[sentiment]}
    </Badge>
  )
}

/** Diverging bar: centre = 0, fills left for negative, right for positive. */
export function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(-1, Math.min(1, score))
  const pct = Math.abs(clamped) * 50
  const label = `Tone score ${clamped >= 0 ? '+' : '−'}${Math.abs(clamped).toFixed(2)}`
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>−1</span>
      <div role="img" aria-label={label} className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
        <div
          aria-hidden
          className={cn('absolute inset-y-0', clamped >= 0 ? 'bg-emerald-500' : 'bg-red-500')}
          style={clamped >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
        />
      </div>
      <span>+1</span>
    </div>
  )
}

interface Props {
  symbol: string
  /** Widget mode: badge, score and summary only. */
  compact?: boolean
  /** Explain on the page when the server has no key; widgets stay silent. */
  showDisabledNote?: boolean
}

/**
 * On-demand AI read of recent news tone. Nothing is fetched until the user clicks; the API
 * caches one report per symbol per hour, and TanStack keeps it for the same hour so the
 * dashboard widget can show a result the Sentiment tab already paid for.
 */
export function SentimentPanel({ symbol, compact = false, showDisabledNote = false }: Props) {
  const status = useSentimentStatus()
  const [requested, setRequested] = useState(false)
  const sentiment = useSentiment(symbol, requested)
  const enabled = status.data?.enabled ?? false

  if (status.isPending) return null
  if (!enabled) {
    return showDisabledNote ? (
      <p className="text-sm text-muted-foreground" data-testid="sentiment-disabled">
        AI news sentiment is not enabled on this server (no Anthropic API key configured).
      </p>
    ) : null
  }

  const data = sentiment.data
  const busy = requested && sentiment.isPending

  if (!data && !busy && !sentiment.isError) {
    return (
      <div className={cn('flex flex-wrap items-center gap-3', compact ? 'p-3' : '')} data-testid="sentiment-idle">
        <Button variant="outline" size={compact ? 'sm' : 'default'} onClick={() => setRequested(true)}>
          <SparklesIcon data-icon="inline-start" aria-hidden />
          {compact ? 'Analyse' : 'Analyse news sentiment'}
        </Button>
        {!compact && (
          <span className="text-xs text-muted-foreground">Reads recent headlines for {symbol} and summarises their tone. Takes 10–30 s.</span>
        )}
      </div>
    )
  }

  if (busy) {
    return (
      <p className={cn('text-sm text-muted-foreground', compact && 'p-3')} aria-busy aria-live="polite" data-testid="sentiment-loading">
        Reading recent headlines for {symbol}… this usually takes 10–30 seconds.
      </p>
    )
  }

  if (sentiment.isError) {
    const err = sentiment.error
    const message =
      err instanceof ApiError && err.isRateLimited
        ? 'Too many analyses right now. Try again in a minute.'
        : err instanceof ApiError && err.isNotFound
          ? `No data for ${symbol}.`
          : err instanceof Error
            ? err.message
            : 'Could not analyse the news.'
    return (
      <div className={cn('space-y-2', compact && 'p-3')}>
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
        <Button variant="outline" size="sm" onClick={() => sentiment.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  return <Result data={data!} compact={compact} />
}

function Result({ data, compact }: { data: SentimentOut; compact: boolean }) {
  const { report } = data
  const generated = new Date(data.generated_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const footer = (
    <p className="text-xs text-muted-foreground" data-testid="sentiment-footer">
      <Link to="/disclaimer" className="underline underline-offset-4">
        {data.disclaimer}
      </Link>{' '}
      · {data.news_count} {data.news_count === 1 ? 'article' : 'articles'} · generated {generated}
      {data.cached && ' · cached'}
    </p>
  )

  if (!report) {
    return (
      <div className={cn('space-y-2', compact && 'p-3')} data-testid="sentiment-result">
        <p className="text-sm text-muted-foreground">No recent news found for {data.symbol}, so there is nothing to analyse.</p>
        {footer}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', compact && 'p-3')} data-testid="sentiment-result">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SentimentBadge sentiment={report.overall} className="h-6 px-2.5 text-sm" />
        <span className="text-xs text-muted-foreground tabular-nums" data-testid="sentiment-confidence">
          {Math.round(report.confidence * 100)}% confidence
        </span>
      </div>
      <ScoreBar score={report.score} />
      {report.themes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Themes">
          {report.themes.map((theme) => (
            <li key={theme}>
              <Badge variant="outline">{theme}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className={cn('text-sm', compact && 'line-clamp-4')} data-testid="sentiment-summary">
        {report.summary}
      </p>
      {!compact && data.articles.length > 0 && (
        <ol className="divide-y rounded-lg border" aria-label="Articles">
          {data.articles.map((a) => (
            <li key={a.index} className="space-y-1 p-3 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                {a.sentiment && <SentimentBadge sentiment={a.sentiment} />}
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer noopener" className="font-medium underline-offset-4 hover:underline">
                    {a.title}
                    <ExternalLinkIcon className="ml-1 inline size-3 align-[-1px] text-muted-foreground" aria-hidden />
                  </a>
                ) : (
                  <span className="font-medium">{a.title}</span>
                )}
              </div>
              {a.rationale && <p className="text-muted-foreground">{a.rationale}</p>}
              <p className="text-xs text-muted-foreground">
                {[a.provider, a.published_at ? new Date(a.published_at).toLocaleDateString() : null].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ol>
      )}
      {footer}
    </div>
  )
}
