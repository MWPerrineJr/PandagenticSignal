import type { PortfolioStats } from '@/lib/api'
import { useTheme } from '@/components/theme-provider'
import { VIZ_PALETTES } from '@/lib/viz-palette'

const CELL = 44
const LABEL = 64

/** Heatmap of pairwise return correlations: red = move together, blue = offset each other. */
export function CorrelationMatrix({ stats }: { stats: PortfolioStats }) {
  const { theme } = useTheme()
  const palette = VIZ_PALETTES[theme]
  const n = stats.symbols.length
  if (n < 2) return null
  const width = LABEL + n * CELL
  const height = LABEL + n * CELL
  const fill = (v: number) => (v >= 0 ? palette.diverging.strongSell : palette.diverging.strongBuy)

  return (
    <figure className="space-y-2" aria-labelledby="corr-caption">
      <figcaption id="corr-caption" className="text-sm font-medium">
        Return correlation
      </figcaption>
      <div className="overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Correlation matrix for ${stats.symbols.join(', ')}`} className="max-w-full">
          {stats.symbols.map((s, i) => (
            <g key={s}>
              <text x={LABEL - 6} y={LABEL + i * CELL + CELL / 2 + 4} textAnchor="end" fontSize={11} fill={palette.muted} className="font-mono">
                {s}
              </text>
              <text x={LABEL + i * CELL + CELL / 2} y={LABEL - 8} textAnchor="middle" fontSize={11} fill={palette.muted} className="font-mono">
                {s}
              </text>
            </g>
          ))}
          {stats.correlation.map((row, i) =>
            row.map((v, j) => (
              <g key={`${i}-${j}`}>
                <rect x={LABEL + j * CELL} y={LABEL + i * CELL} width={CELL - 2} height={CELL - 2} rx={4} fill={fill(v)} fillOpacity={Math.min(1, Math.abs(v))} stroke={palette.grid} />
                <text x={LABEL + j * CELL + CELL / 2 - 1} y={LABEL + i * CELL + CELL / 2 + 4} textAnchor="middle" fontSize={11} fill="currentColor" className="tabular-nums">
                  {v.toFixed(2)}
                </text>
              </g>
            )),
          )}
        </svg>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Table view</summary>
        <table className="mt-2 tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-3 text-left font-medium">Symbol</th>
              {stats.symbols.map((s) => (
                <th key={s} scope="col" className="px-2 py-1 text-right font-medium">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.correlation.map((row, i) => (
              <tr key={stats.symbols[i]} className="border-t">
                <th scope="row" className="py-1 pr-3 text-left font-normal">{stats.symbols[i]}</th>
                {row.map((v, j) => (
                  <td key={j} className="px-2 py-1 text-right">{v.toFixed(2)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
