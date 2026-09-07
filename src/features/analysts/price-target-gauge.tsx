import type { Recommendations } from '@/lib/api'
import { trackPosition, upside } from '@/lib/analysts'
import { formatPct } from '@/lib/compare'
import { formatPrice } from '@/lib/format'
import { useTheme } from '@/components/theme-provider'
import { VIZ_PALETTES } from '@/lib/viz-palette'

/** Low → high target track with mean, median and the current price marked. */
export function PriceTargetGauge({ targets }: { targets: Recommendations['price_targets'] }) {
  const { theme } = useTheme()
  const viz = VIZ_PALETTES[theme]
  const { low, high, mean, median, current } = targets
  if (low == null || high == null || high <= low) return null

  // Extend the track so an out-of-range current price still shows.
  const lo = Math.min(low, current ?? low)
  const hi = Math.max(high, current ?? high)
  const pos = (v: number | null | undefined) => trackPosition(v, lo, hi)
  const lowPos = pos(low)! * 100
  const highPos = pos(high)! * 100
  const marks = [
    { key: 'mean', label: 'Mean', value: mean, color: viz.diverging.strongBuy },
    { key: 'median', label: 'Median', value: median, color: viz.diverging.buy },
  ].filter((m) => m.value != null)
  const currentPos = pos(current)

  return (
    <figure className="space-y-3" aria-labelledby="target-caption">
      <figcaption id="target-caption" className="text-sm font-medium">
        Price targets
      </figcaption>
      <div className="relative h-14 pt-5">
        <div className="relative h-2 rounded-full" style={{ background: viz.grid }}>
          <span
            className="absolute inset-y-0 rounded-full"
            style={{ left: `${lowPos}%`, width: `${highPos - lowPos}%`, background: viz.diverging.buy, opacity: 0.45 }}
            aria-hidden
          />
          {marks.map((m) => (
            <span
              key={m.key}
              role="img"
              aria-label={`${m.label} target ${formatPrice(m.value)}`}
              title={`${m.label} target ${formatPrice(m.value)}`}
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
              style={{ left: `${pos(m.value)! * 100}%`, background: m.color }}
            />
          ))}
          {currentPos != null && (
            <span
              role="img"
              aria-label={`Current price ${formatPrice(current)}`}
              className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground"
              style={{ left: `${currentPos * 100}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium">
                {formatPrice(current)}
              </span>
            </span>
          )}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>Low {formatPrice(low)}</span>
          <span>High {formatPrice(high)}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        {[
          { label: 'Mean target', value: mean },
          { label: 'Median target', value: median },
          { label: 'Low', value: low },
          { label: 'High', value: high },
        ].map((item) => {
          const delta = upside(current, item.value)
          return (
            <div key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="tabular-nums">
                {formatPrice(item.value)}
                {delta != null && (
                  <span className={delta >= 0 ? 'ml-1 text-xs text-emerald-500' : 'ml-1 text-xs text-red-500'}>
                    {formatPct(delta, 1)}
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </figure>
  )
}
