import { useMemo } from 'react'
import type { YearPoint } from '@/lib/retirement'
import { formatCompact, formatPrice } from '@/lib/format'
import { useTheme } from '@/components/theme-provider'
import { VIZ_PALETTES } from '@/lib/viz-palette'

const W = 640
const H = 300
const PAD = { top: 12, right: 16, bottom: 28, left: 56 }

/** Deterministic nest egg by age: nominal and today's-dollar lines with a retirement marker. */
export function NestEggChart({ points, retirementAge }: { points: YearPoint[]; retirementAge: number }) {
  const { theme } = useTheme()
  const palette = VIZ_PALETTES[theme]
  const [nominalColor, realColor] = [palette.categorical[0]!, palette.categorical[2]!]

  const g = useMemo(() => {
    const ages = points.map((p) => p.age)
    const a0 = ages[0] ?? 0
    const a1 = ages.at(-1) ?? a0 + 1
    const yMax = Math.max(1, ...points.map((p) => p.balance_nominal)) * 1.05
    const x = (age: number) => PAD.left + ((age - a0) / Math.max(1, a1 - a0)) * (W - PAD.left - PAD.right)
    const y = (v: number) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom)
    const path = (pick: (p: YearPoint) => number) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.age).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')
    const step = a1 - a0 > 40 ? 10 : 5
    const xTicks = ages.filter((a) => a % step === 0)
    const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4)
    const peak = points.reduce((m, p) => (p.balance_nominal > m.balance_nominal ? p : m), points[0]!)
    return { x, y, nominal: path((p) => p.balance_nominal), real: path((p) => p.balance_real), xTicks, yTicks, peak }
  }, [points])

  if (points.length < 2) return null
  const { x, y, nominal, real, xTicks, yTicks, peak } = g
  const rows = points.filter((p) => p.age % 5 === 0 || p.age === retirementAge || p === points.at(-1))

  return (
    <figure className="space-y-2" aria-labelledby="nest-caption">
      <figcaption id="nest-caption" className="text-sm font-medium">
        Projected nest egg by age
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected balance by age, nominal and in today's dollars" className="h-auto w-full" data-testid="nest-egg-chart">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke={palette.grid} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={palette.muted}>
              {formatCompact(v)}
            </text>
          </g>
        ))}
        {xTicks.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize={10} fill={palette.muted}>
            {a}
          </text>
        ))}
        <line x1={x(retirementAge)} x2={x(retirementAge)} y1={PAD.top} y2={H - PAD.bottom} stroke={palette.muted} strokeDasharray="4 4" data-marker="retirement" />
        <text x={x(retirementAge) + 4} y={PAD.top + 10} fontSize={10} fill={palette.muted}>
          retire at {retirementAge}
        </text>
        <path d={nominal} fill="none" stroke={nominalColor} strokeWidth={2} data-series="nominal" />
        <path d={real} fill="none" stroke={realColor} strokeWidth={2} strokeDasharray="6 3" data-series="real" />
        <circle cx={x(peak.age)} cy={y(peak.balance_nominal)} r={3} fill={nominalColor} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: nominalColor }} aria-hidden /> Nominal</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: realColor }} aria-hidden /> Today’s dollars</span>
        <span>Peak {formatPrice(peak.balance_nominal)} at {peak.age}</span>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Table view</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 text-left font-medium">Age</th>
              <th scope="col" className="py-1 text-right font-medium">Cashflow</th>
              <th scope="col" className="py-1 text-right font-medium">Nominal</th>
              <th scope="col" className="py-1 text-right font-medium">Today’s $</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.age} className="border-t">
                <th scope="row" className="py-1 text-left font-normal">{p.age}</th>
                <td className="py-1 text-right">{formatPrice(p.cashflow)}</td>
                <td className="py-1 text-right">{formatPrice(p.balance_nominal)}</td>
                <td className="py-1 text-right">{formatPrice(p.balance_real)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
