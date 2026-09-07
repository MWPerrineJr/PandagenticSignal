import { XIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { useTickerStore } from '@/stores/tickers'
import { MAX_COMPARE, VIZ_PALETTES } from '@/lib/viz-palette'
import { TickerSearch } from '@/features/search/ticker-search'
import { cn } from '@/lib/utils'

export interface ComparePickerProps {
  primary: string
  compare: string[]
  onToggle: (symbol: string) => void
  onClear: () => void
}

/** Chips for the tracked tickers plus a search box; up to MAX_COMPARE symbols in total. */
export function ComparePicker({ primary, compare, onToggle, onClear }: ComparePickerProps) {
  const tracked = useTickerStore((s) => s.tickers)
  const { theme } = useTheme()
  const colors = VIZ_PALETTES[theme].categorical
  const candidates = Array.from(new Set([...tracked, ...compare])).filter((s) => s !== primary)
  const full = compare.length >= MAX_COMPARE - 1

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Compare with">
      <span className="text-sm text-muted-foreground">Compare with</span>
      {candidates.length === 0 && <span className="text-sm text-muted-foreground">tracked symbols appear here.</span>}
      {candidates.map((symbol) => {
        const idx = compare.indexOf(symbol)
        const on = idx >= 0
        return (
          <Button
            key={symbol}
            type="button"
            size="sm"
            variant={on ? 'secondary' : 'ghost'}
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onToggle(symbol)}
            className={cn('h-7 gap-1.5 font-mono text-xs', !on && 'text-muted-foreground')}
          >
            <span
              className="inline-block h-0.5 w-3 rounded"
              style={{ background: on ? colors[idx + 1] : 'currentColor', opacity: on ? 1 : 0.4 }}
              aria-hidden
            />
            {symbol}
          </Button>
        )
      })}
      {!full && <TickerSearch onSelect={onToggle} label="Add a symbol to compare" placeholder="Add symbol" className="w-40" />}
      {compare.length > 0 && (
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClear}>
          <XIcon /> Clear
        </Button>
      )}
    </div>
  )
}
