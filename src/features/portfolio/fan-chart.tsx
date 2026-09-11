import { useMemo } from 'react'
import type { Simulation } from '@/lib/api'
import { formatCompact, formatPrice } from '@/lib/format'
import { useTheme } from '@/components/theme-provider'
import { VIZ_PALETTES } from '@/lib/viz-palette'

const W = 640
const H = 320
const PAD = { top: 12, right: 16, bottom: 28, left: 56 }

/**
 * Percentile fan of simulated wealth: 5–95 band, 25–75 band, median line. SVG rather than
 * lightweight-charts because bands need filled polygons and jsdom can assert on paths.
 */
export function FanChart({ sim, title = 'Simulated wealth' }: { sim: Simulation; title?: string }) {
  const { theme } = useTheme()
  const palette = VIZ_PALETTES[theme]
  const accent = palette.categorical[0]!

  const geometry = useMemo(() => {
    const { times, bands } = sim
    const xMax = times.at(-1) || 1
    const yMax = Math.max(...(bands.p95 ?? []), sim.initial_value) * 1.05
    const x = (t: number) => PAD.left + (t / xMax) * (W - PAD.left - PAD.right)
    const y = (v: number) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom)
    const line = (vals: number[]) => vals.map((v, i) => `${x(times[i]!).toFixed(1)},${y(v).toFixed(1)}`)
    const area = (lo: number[], hi: number[]) => [...line(hi), ...line(lo).reverse()].join(' ')
    const outer = area(bands.p5 ?? [], bands.p95 ?? [])
    const inner = area(bands.p25 ?? [], bands.p75 ?? [])
    const median = line(bands.p50 ?? [])
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`)
      .join(' ')
    const yearStep = xMax <= 10 ? 1 : xMax <= 20 ? 2 : 5
    const xTicks = Array.from({ length: Math.floor(xMax / yearStep) + 1 }, (_, i) => i * yearStep)
    const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4)
    return { x, y, outer, inner, median, xTicks, yTicks }
  }, [sim])

  const tableRows = useMemo(() => {
    const step = Math.max(1, Math.round((sim.times.length - 1) / 10))
    const idx = sim.times.map((_, i) => i).filter((i) => i % step === 0 || i === sim.times.length - 1)
    return idx.map((i) => ({ t: sim.times[i]!, p5: sim.bands.p5?.[i], p25: sim.bands.p25?.[i], p50: sim.bands.p50?.[i], p75: sim.bands.p75?.[i], p95: sim.bands.p95?.[i] }))
  }, [sim])

  const { x, y, outer, inner, median, xTicks, yTicks } = geometry
  return (
    <figure className="space-y-2" aria-labelledby="fan-caption">
      <figcaption id="fan-caption" className="text-sm font-medium">
        {title} over {sim.horizon_years} {sim.horizon_years === 1 ? 'year' : 'years'} · {sim.n_sims.toLocaleString()} paths
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: median and 5th to 95th percentile bands`} className="h-auto w-full max-w-full" data-testid="fan-chart">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke={palette.grid} strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={palette.muted}>
              {formatCompact(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={10} fill={palette.muted}>
            {t}y
          </text>
        ))}
        <polygon points={outer} fill={accent} fillOpacity={0.15} data-band="p5-p95" />
        <polygon points={inner} fill={accent} fillOpacity={0.3} data-band="p25-p75" />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(sim.initial_value)} y2={y(sim.initial_value)} stroke={palette.muted} strokeDasharray="4 4" />
        <path d={median} fill="none" stroke={accent} strokeWidth={2} data-series="median" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: accent }} aria-hidden /> Median</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: accent, opacity: 0.3 }} aria-hidden /> 25th–75th percentile</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: accent, opacity: 0.15 }} aria-hidden /> 5th–95th percentile</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t border-dashed" style={{ borderColor: palette.muted }} aria-hidden /> Starting value</span>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Table view</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 text-left font-medium">Year</th>
              {['5th', '25th', 'Median', '75th', '95th'].map((h) => (
                <th key={h} scope="col" className="py-1 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => (
              <tr key={r.t} className="border-t">
                <th scope="row" className="py-1 text-left font-normal">{r.t.toFixed(1)}</th>
                {[r.p5, r.p25, r.p50, r.p75, r.p95].map((v, i) => (
                  <td key={i} className="py-1 text-right">{formatPrice(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
