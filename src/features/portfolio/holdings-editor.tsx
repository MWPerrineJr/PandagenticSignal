import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { MAX_HOLDINGS, normaliseHoldings, weightsFromHoldings, type Holding, type HoldingMode } from '@/lib/portfolio'
import { formatPercent } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TickerSearch } from '@/features/search/ticker-search'

export interface HoldingsEditorProps {
  holdings: Holding[]
  mode: HoldingMode
  onChange: (holdings: Holding[], mode: HoldingMode) => void
}

const DEFAULT_VALUE: Record<HoldingMode, number> = { weight: 10, amount: 1000 }

export function HoldingsEditor({ holdings, mode, onChange }: HoldingsEditorProps) {
  const weights = weightsFromHoldings(holdings)
  const full = holdings.length >= MAX_HOLDINGS
  const total = holdings.reduce((s, h) => s + h.value, 0)
  // Value inputs are uncontrolled so a cleared field can be retyped; bump to remount them
  // when values change from outside the inputs (normalise, mode switch).
  const [epoch, setEpoch] = useState(0)

  const add = (symbol: string) => {
    if (full) return
    onChange(normaliseHoldings([...holdings, { symbol, value: DEFAULT_VALUE[mode] }]), mode)
  }
  const setValue = (symbol: string, value: number) => {
    onChange(
      holdings.map((h) => (h.symbol === symbol ? { ...h, value: Number.isFinite(value) && value > 0 ? value : h.value } : h)),
      mode,
    )
  }
  const remove = (symbol: string) => onChange(holdings.filter((h) => h.symbol !== symbol), mode)
  const normalise = () => {
    onChange(holdings.map((h, i) => ({ ...h, value: Math.round(weights[i]! * 1000) / 10 })), 'weight')
    setEpoch((e) => e + 1)
  }
  const switchMode = (m: HoldingMode) => {
    onChange(holdings, m)
    setEpoch((e) => e + 1)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <TickerSearch onSelect={add} label="Add a holding" placeholder={full ? 'Portfolio is full' : 'Add a symbol or company'} className="w-64 sm:w-80" />
        <fieldset className="flex items-center gap-2 text-sm">
          <legend className="sr-only">Holding sizes are</legend>
          {(['weight', 'amount'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" name="holding-mode" value={m} checked={mode === m} onChange={() => switchMode(m)} />
              {m === 'weight' ? 'Weights' : 'Amounts ($)'}
            </label>
          ))}
        </fieldset>
        {mode === 'weight' && holdings.length > 0 && (
          <Button variant="outline" size="sm" onClick={normalise} disabled={Math.abs(total - 100) < 0.05}>
            Normalise to 100%
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {holdings.length}/{MAX_HOLDINGS} holdings
        </span>
      </div>
      {holdings.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No holdings yet. Add stocks, ETFs or coins above; sizes can be relative weights or dollar amounts.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <caption className="sr-only">Portfolio holdings</caption>
            <TableHeader className="bg-muted/40 text-xs text-muted-foreground">
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">{mode === 'weight' ? 'Weight' : 'Amount ($)'}</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h, i) => (
                <TableRow key={h.symbol} data-testid={`holding-${h.symbol}`}>
                  <TableCell className="font-mono font-semibold">{h.symbol}</TableCell>
                  <TableCell className="text-right">
                    <input
                      key={`${h.symbol}-${mode}-${epoch}`}
                      type="number"
                      min={0}
                      step={mode === 'weight' ? 1 : 100}
                      defaultValue={h.value}
                      onChange={(e) => setValue(h.symbol, Number(e.target.value))}
                      aria-label={`${mode === 'weight' ? 'Weight' : 'Amount'} for ${h.symbol}`}
                      className="h-7 w-24 rounded-md border bg-background px-2 text-right text-sm tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(weights[i])}</TableCell>
                  <TableCell className="py-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${h.symbol}`} onClick={() => remove(h.symbol)}>
                      <XIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
