import { useMemo } from 'react'
import { useHistory } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** One-month close-price trend. De-emphasised stroke; the end dot carries the direction. */
export function Sparkline({ symbol, width = 96, height = 28 }: { symbol: string; width?: number; height?: number }) {
  const { data } = useHistory(symbol, '1mo', '1d')
  const closes = useMemo(() => data?.candles.map((c) => c.close) ?? [], [data])
  if (closes.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden />

  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1
  const pad = 4
  const x = (i: number) => pad + (i / (closes.length - 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
  const d = closes.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const up = closes.at(-1)! >= closes[0]!
  const last = closes.length - 1

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${symbol} one-month trend, ${up ? 'up' : 'down'}`}
      className="overflow-visible"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className="text-muted-foreground/70" />
      <circle cx={x(last)} cy={y(closes[last]!)} r={3} className={cn(up ? 'fill-emerald-500' : 'fill-red-500', 'stroke-background')} strokeWidth={2} />
    </svg>
  )
}
