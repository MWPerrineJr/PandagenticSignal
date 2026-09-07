import { useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { GRADES, GRADE_LABELS, periodLabel, totalAnalysts, type Grade, type Summary } from '@/lib/analysts'
import { VIZ_PALETTES } from '@/lib/viz-palette'
import { cn } from '@/lib/utils'

/**
 * Diverging stacked bar per month, centred on Hold: sells grow left, buys grow right.
 * Segments are separated by a 2px surface gap; counts are labelled only where they fit.
 */
export function RecommendationBars({ summary }: { summary: Summary[] }) {
  const { theme } = useTheme()
  const colors = VIZ_PALETTES[theme].diverging
  const [tip, setTip] = useState<{ period: string; grade: Grade } | null>(null)
  const rows = summary.filter((p) => totalAnalysts(p) > 0)
  if (rows.length === 0) return null

  // Half of Hold sits on each side of the centre line; scale by the widest half-bar.
  const extent = (p: Summary) => Math.max(p.strong_sell + p.sell + p.hold / 2, p.buy + p.strong_buy + p.hold / 2)
  const scale = Math.max(...rows.map(extent)) || 1
  const pct = (n: number) => (n / scale) * 50

  const fill: Record<Grade, string> = {
    strong_buy: colors.strongBuy,
    buy: colors.buy,
    hold: colors.hold,
    sell: colors.sell,
    strong_sell: colors.strongSell,
  }
  const tipRow = tip ? rows.find((r) => r.period === tip.period) : undefined

  return (
    <figure className="space-y-3" aria-labelledby="rec-caption">
      <figcaption id="rec-caption" className="text-sm font-medium">
        Analyst ratings by month
      </figcaption>
      <div className="space-y-2" role="list">
        {rows.map((p) => {
          // Left arm is drawn right-to-left from the centre so Sell touches Hold.
          const left: Array<[Grade, number]> = [
            ['sell', p.sell],
            ['strong_sell', p.strong_sell],
          ]
          const right: Array<[Grade, number]> = [
            ['buy', p.buy],
            ['strong_buy', p.strong_buy],
          ]
          return (
            <div key={p.period} role="listitem" className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-xs">
              <span className="text-muted-foreground">{periodLabel(p.period)}</span>
              <div className="relative h-5">
                <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
                <Segment grade="hold" count={p.hold} left={50 - pct(p.hold / 2)} width={pct(p.hold)} fill={fill.hold} period={p.period} onHover={setTip} />
                {left.reduce<{ edge: number; nodes: React.ReactNode[] }>(
                  (acc, [grade, count]) => {
                    const w = pct(count)
                    acc.nodes.push(
                      <Segment key={grade} grade={grade} count={count} left={acc.edge - w} width={w} fill={fill[grade]} period={p.period} onHover={setTip} />,
                    )
                    acc.edge -= w
                    return acc
                  },
                  { edge: 50 - pct(p.hold / 2), nodes: [] },
                ).nodes}
                {right.reduce<{ edge: number; nodes: React.ReactNode[] }>(
                  (acc, [grade, count]) => {
                    const w = pct(count)
                    acc.nodes.push(
                      <Segment key={grade} grade={grade} count={count} left={acc.edge} width={w} fill={fill[grade]} period={p.period} onHover={setTip} />,
                    )
                    acc.edge += w
                    return acc
                  },
                  { edge: 50 + pct(p.hold / 2), nodes: [] },
                ).nodes}
              </div>
              <span className="text-right tabular-nums text-muted-foreground">{totalAnalysts(p)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {GRADES.map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: fill[g] }} aria-hidden />
            <span className="text-muted-foreground">{GRADE_LABELS[g]}</span>
          </span>
        ))}
        {tip && tipRow && (
          <span role="status" className="ml-auto rounded bg-muted px-2 py-0.5 tabular-nums">
            {periodLabel(tip.period)}: {tipRow[tip.grade]} {GRADE_LABELS[tip.grade].toLowerCase()} of {totalAnalysts(tipRow)}
          </span>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Table view</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 text-left font-medium">Period</th>
              {GRADES.map((g) => (
                <th key={g} scope="col" className="py-1 text-right font-medium">{GRADE_LABELS[g]}</th>
              ))}
              <th scope="col" className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.period} className="border-t">
                <th scope="row" className="py-1 text-left font-normal">{periodLabel(p.period)}</th>
                {GRADES.map((g) => (
                  <td key={g} className="py-1 text-right">{p[g]}</td>
                ))}
                <td className="py-1 text-right">{totalAnalysts(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function Segment({
  grade,
  count,
  left,
  width,
  fill,
  period,
  onHover,
}: {
  grade: Grade
  count: number
  left: number
  width: number
  fill: string
  period: string
  onHover: (tip: { period: string; grade: Grade } | null) => void
}) {
  if (count <= 0) return null
  const label = `${count} ${GRADE_LABELS[grade].toLowerCase()}`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      onMouseEnter={() => onHover({ period, grade })}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover({ period, grade })}
      onBlur={() => onHover(null)}
      tabIndex={0}
      className={cn(
        'absolute inset-y-0 flex items-center justify-center rounded-[3px] text-[10px] font-medium text-white outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring',
        grade === 'hold' && 'text-foreground',
      )}
      style={{ left: `${left}%`, width: `calc(${width}% - 2px)`, marginLeft: 1, background: fill }}
      data-grade={grade}
    >
      {width >= 8 ? count : null}
    </span>
  )
}
