import { useState } from 'react'
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, SparklesIcon } from 'lucide-react'
import type { Recommendations } from '@/lib/api'
import { gradeDirection, type GradeDirection } from '@/lib/analysts'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PAGE = 15

const DIRECTION: Record<GradeDirection, { label: string; icon: typeof ArrowUpRightIcon; className: string }> = {
  up: { label: 'Upgrade', icon: ArrowUpRightIcon, className: 'text-emerald-500' },
  down: { label: 'Downgrade', icon: ArrowDownRightIcon, className: 'text-red-500' },
  new: { label: 'Initiated', icon: SparklesIcon, className: 'text-muted-foreground' },
  same: { label: 'Reiterated', icon: MinusIcon, className: 'text-muted-foreground' },
}

export function formatGradeDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function GradeTable({ rows }: { rows: Recommendations['upgrades_downgrades'] }) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) return null
  const visible = showAll ? rows : rows.slice(0, PAGE)

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Upgrades and downgrades</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">Recent analyst rating changes</caption>
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Date</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Firm</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Action</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Rating</th>
              <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((g, i) => {
              const dir = DIRECTION[gradeDirection(g.action)]
              const Icon = dir.icon
              return (
                <tr key={`${g.date}-${g.firm}-${i}`}>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatGradeDate(g.date)}</td>
                  <td className="px-3 py-2">{g.firm}</td>
                  <td className="px-3 py-2">
                    <span className={cn('flex items-center gap-1', dir.className)}>
                      <Icon className="size-3.5" aria-hidden />
                      {dir.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {g.from_grade && g.from_grade !== g.to_grade ? (
                      <>
                        <span className="text-muted-foreground">{g.from_grade}</span>
                        <span aria-hidden> → </span>
                        <span className="sr-only"> to </span>
                      </>
                    ) : null}
                    {g.to_grade ?? '—'}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums sm:table-cell">
                    {g.current_price_target != null ? (
                      <>
                        {g.prior_price_target != null && g.prior_price_target !== g.current_price_target && (
                          <span className="text-muted-foreground">{formatPrice(g.prior_price_target)} → </span>
                        )}
                        {formatPrice(g.current_price_target)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${rows.length}`}
        </Button>
      )}
    </div>
  )
}
