import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import type { IndicatorCatalog, IndicatorSpec } from '@/lib/api'
import {
  CATALOG_GROUPS,
  MAX_INDICATORS,
  canonicalToken,
  makeToken,
  specOf,
  tokenId,
  tokenLabel,
  tokenValues,
} from '@/lib/indicators'
import { CHART_PALETTES, seriesColor } from '@/lib/chart-theme'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface IndicatorPickerProps {
  catalog: IndicatorCatalog | undefined
  tokens: readonly string[]
  onChange: (tokens: string[]) => void
  onReset?: () => void
  disabled?: boolean
  /** Widget settings: no popover, render the editor inline. */
  inline?: boolean
}

/**
 * Chooses which indicators a chart requests. Active indicators are chips with inline parameter
 * fields; a grouped select adds more (the same indicator can be added twice with different
 * parameters, e.g. SMA 20 and SMA 50). Native controls, so it works without a pointer.
 */
export function IndicatorPicker({ catalog, tokens, onChange, onReset, disabled = false, inline = false }: IndicatorPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const editor = (
    <IndicatorEditor catalog={catalog} tokens={tokens} onChange={onChange} onReset={onReset} disabled={disabled} />
  )
  if (inline) return editor

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        Indicators
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums" data-testid="indicator-count">
          {tokens.length}
        </span>
        <ChevronDownIcon data-icon="inline-end" aria-hidden />
      </Button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Indicators"
          className="absolute right-0 z-30 mt-1 w-[min(28rem,calc(100vw-2rem))] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
        >
          {editor}
        </div>
      )}
    </div>
  )
}

function IndicatorEditor({
  catalog,
  tokens,
  onChange,
  onReset,
  disabled,
}: Pick<IndicatorPickerProps, 'catalog' | 'tokens' | 'onChange' | 'onReset' | 'disabled'>) {
  const { theme } = useTheme()
  const palette = CHART_PALETTES[theme]
  const full = tokens.length >= MAX_INDICATORS

  const add = (specId: string) => {
    if (!specId || !catalog) return
    const token = canonicalToken(specId, catalog)
    if (!token || tokens.includes(token) || full) return
    onChange([...tokens, token])
  }
  const remove = (index: number) => onChange(tokens.filter((_, i) => i !== index))
  const setParam = (index: number, paramIndex: number, value: number) => {
    const token = tokens[index]!
    const spec = specOf(token, catalog)
    if (!spec) return
    const values = spec.params.map((p, i) => tokenValues(token)[i] ?? p.default)
    values[paramIndex] = value
    const next = canonicalToken(makeToken(spec.id, values), catalog!)
    if (!next || (tokens.includes(next) && next !== token)) return
    onChange(tokens.map((t, i) => (i === index ? next : t)))
  }

  return (
    <div className="space-y-3" data-testid="indicator-editor">
      <ul className="space-y-1.5" aria-label="Active indicators">
        {tokens.length === 0 && <li className="text-xs text-muted-foreground">No indicators. Add one below.</li>}
        {tokens.map((token, index) => {
          const spec = specOf(token, catalog)
          const values = tokenValues(token)
          return (
            <li key={token} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`indicator-${token}`}>
              <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: seriesColor(palette, index) }} aria-hidden />
              <span className="min-w-20 font-medium" title={spec?.name}>
                {tokenLabel(token)}
              </span>
              {spec?.params.map((p, pi) => (
                <label key={p.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {p.name}
                  <input
                    type="number"
                    className="h-6 w-16 rounded-md border bg-background px-1.5 text-xs text-foreground tabular-nums"
                    aria-label={`${tokenLabel(token)} ${p.name}`}
                    defaultValue={values[pi] ?? p.default}
                    min={p.min}
                    max={p.max}
                    step={p.integer ? 1 : 0.1}
                    disabled={disabled}
                    onBlur={(e) => {
                      const v = Number(e.currentTarget.value)
                      if (Number.isFinite(v) && v !== (values[pi] ?? p.default)) setParam(index, pi, v)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                    }}
                  />
                </label>
              ))}
              <button
                type="button"
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label={`Remove ${tokenLabel(token)}`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={cn('h-7 max-w-full rounded-md border bg-background px-2 text-xs', full && 'opacity-60')}
          aria-label="Add indicator"
          value=""
          disabled={disabled || !catalog || full}
          onChange={(e) => add(e.target.value)}
        >
          <option value="">{full ? `Limit of ${MAX_INDICATORS} reached` : catalog ? 'Add indicator…' : 'Loading indicators…'}</option>
          {catalog &&
            CATALOG_GROUPS.map((group) => (
              <optgroup key={group.kind} label={group.label}>
                {catalog.indicators
                  .filter((s) => s.kind === group.kind)
                  .map((s: IndicatorSpec) => (
                    <option key={s.id} value={s.id} title={s.description}>
                      {s.name}
                      {tokens.some((t) => tokenId(t) === s.id) ? ' (added)' : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>
        {onReset && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
            Reset to defaults
          </Button>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {tokens.length}/{MAX_INDICATORS}
        </span>
      </div>
    </div>
  )
}
