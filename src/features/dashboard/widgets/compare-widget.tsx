import { useMemo } from 'react'
import { useHistories } from '@/lib/queries'
import { useWatchlist } from '@/lib/use-watchlist'
import { normaliseSeries } from '@/lib/compare'
import { normaliseSymbol, type Candle } from '@/lib/api'
import { MAX_COMPARE } from '@/lib/viz-palette'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CompareChart } from '@/features/charts/compare-chart'
import { PeriodField } from './settings-fields'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function CompareWidget({ config }: WidgetProps<'compare'>) {
  const { tickers } = useWatchlist()
  const symbols = useMemo(
    () => (config.symbols.length ? config.symbols : tickers).slice(0, MAX_COMPARE),
    [config.symbols, tickers],
  )
  const results = useHistories(symbols, config.period, '1d')
  const series = useMemo(() => {
    const input: Record<string, Candle[] | undefined> = {}
    symbols.forEach((s, i) => {
      input[s] = results[i]?.data?.candles
    })
    return normaliseSeries(input, '1d')
  }, [symbols, results])

  if (symbols.length === 0) return <p className="p-4 text-sm text-muted-foreground">Track some symbols or set them in this widget's settings.</p>
  if (series.length === 0 && results.some((r) => r.isPending)) return <Skeleton className="h-full w-full rounded-none" aria-busy aria-label="Loading chart" />
  return <CompareChart series={series} interval="1d" height="100%" />
}

export function CompareWidgetSettings({ config, onChange }: WidgetSettingsProps<'compare'>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2">
        <span className="w-16 text-muted-foreground">Symbols</span>
        <Input
          className="h-7 w-56 font-mono text-xs uppercase"
          placeholder="blank = tracked symbols"
          defaultValue={config.symbols.join(', ')}
          onBlur={(e) =>
            onChange({
              symbols: Array.from(new Set(e.target.value.split(/[,\s]+/).map(normaliseSymbol).filter(Boolean))).slice(0, MAX_COMPARE),
            })
          }
          aria-label="Symbols, comma separated (blank uses tracked symbols)"
        />
      </label>
      <PeriodField value={config.period} onChange={(period) => onChange({ period })} />
    </div>
  )
}
