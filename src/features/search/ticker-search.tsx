import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Loader2Icon, SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/use-debounce'
import { useSearch } from '@/lib/queries'
import type { SearchResult } from '@/lib/api'

export interface TickerSearchProps {
  /** Currently selected symbol, shown as the placeholder when the box is idle. */
  value?: string | null
  onSelect: (symbol: string, result?: SearchResult) => void
  placeholder?: string
  /** Accessible name; give each search box on a page a distinct one. */
  label?: string
  className?: string
  autoFocus?: boolean
}

/**
 * Company-name or symbol combobox backed by `/search`. Typing is debounced 250 ms;
 * results are keyboard navigable (cmdk); Enter on a raw symbol with no results still
 * selects it so power users can type `NVDA⏎`.
 */
export function TickerSearch({
  value,
  onSelect,
  placeholder,
  label = 'Search symbol or company',
  className,
  autoFocus,
}: TickerSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(query, 250)
  const { data, isFetching, isError, error } = useSearch(debounced)
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => data ?? [], [data])
  const showPanel = open && query.trim().length > 0

  // Highlight is derived per result set: cmdk keeps the previous highlight value around,
  // which stops Enter from working once those items are gone. Arrow keys update it via
  // onValueChange, tagged with the result set they belong to.
  const [highlight, setHighlight] = useState<{ results: SearchResult[]; value: string }>({ results, value: '' })
  const highlighted = highlight.results === results ? highlight.value : (results[0]?.symbol ?? '')

  // Close when clicking outside.
  useEffect(() => {
    if (!showPanel) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showPanel])

  const select = (symbol: string, result?: SearchResult) => {
    onSelect(symbol.toUpperCase(), result)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault() // we own Enter; cmdk's own handler is skipped when defaultPrevented
    const hit = results.find((r) => r.symbol.toLowerCase() === highlighted.toLowerCase())
    if (hit) {
      select(hit.symbol, hit)
    } else if (!isFetching && query.trim()) {
      select(query.trim())
    }
  }

  return (
    <CommandPrimitive
      ref={rootRef}
      shouldFilter={false}
      loop
      value={highlighted}
      onValueChange={(value) => setHighlight({ results, value })}
      label={label}
      className={cn('relative', className)}
      onKeyDown={onKeyDown}
    >
      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-within:ring-2 focus-within:ring-ring/50">
        {isFetching ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin opacity-60" aria-hidden />
        ) : (
          <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden />
        )}
        <CommandPrimitive.Input
          value={query}
          onValueChange={(next) => {
            setQuery(next)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? (value ? `${value} · search another symbol` : 'Search symbol or company')}
          aria-label={label}
          aria-expanded={showPanel}
          aria-controls={listId}
          autoFocus={autoFocus}
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <CommandPrimitive.List id={listId} className="max-h-72 overflow-y-auto p-1">
            {isError && (
              <div role="alert" className="px-2 py-4 text-center text-sm text-destructive">
                {error instanceof Error ? error.message : 'Search failed'}
              </div>
            )}
            {!isError && debounced.trim() && !isFetching && results.length === 0 && (
              <CommandPrimitive.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
                No matches for “{debounced.trim()}”. Press Enter to use it as a symbol.
              </CommandPrimitive.Empty>
            )}
            {!isError && results.length > 0 && (
              <CommandPrimitive.Group>
                {results.map((r) => (
                  <CommandPrimitive.Item
                    key={`${r.symbol}-${r.exchange ?? ''}`}
                    value={r.symbol}
                    onSelect={() => select(r.symbol, r)}
                    className="flex cursor-default items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[selected=true]:bg-muted"
                  >
                    <span className="w-20 shrink-0 font-mono font-semibold">{r.symbol}</span>
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {r.exchange ?? r.type}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}
          </CommandPrimitive.List>
        </div>
      )}
    </CommandPrimitive>
  )
}
