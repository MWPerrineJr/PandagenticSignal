import { useState } from 'react'
import { CheckIcon, LayoutDashboardIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { useTicker } from '@/lib/use-ticker'
import { useWatchlist } from '@/lib/use-watchlist'
import { useDashboard } from '@/lib/use-dashboard'
import { addWidget, applyGrid, removeWidget, updateWidgetConfig, MAX_WIDGETS, type WidgetType } from '@/lib/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardGrid } from './dashboard-grid'
import { WIDGET_MENU } from './widgets/registry'

export function DashboardPage() {
  const [ticker] = useTicker()
  const { tickers: tracked, toggle, source: watchlistSource } = useWatchlist()
  const dash = useDashboard()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const isTracked = ticker ? tracked.includes(ticker) : false
  const active = dash.active

  const stopEditing = () => {
    setEditing(false)
    setAdding(false)
    dash.flush()
  }

  const createLayout = () => {
    const name = window.prompt('Name for the new dashboard', `Dashboard ${dash.layouts.length + 1}`)
    if (name) dash.create(name)
  }
  const renameLayout = () => {
    if (!active) return
    const name = window.prompt('Rename dashboard', active.name)
    if (name && name !== active.name) dash.rename(active.id, name)
  }
  const deleteLayout = () => {
    if (!active) return
    if (window.confirm(`Delete “${active.name}”? This cannot be undone.`)) dash.remove(active.id)
  }

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="dashboard-heading" className="text-2xl font-semibold">
          Dashboard
        </h1>
        {dash.layouts.length > 0 && active && (
          <label className="flex items-center gap-2 text-sm">
            <LayoutDashboardIcon className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Layout</span>
            <select
              aria-label="Layout"
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={active.id}
              onChange={(e) => dash.select(e.target.value)}
            >
              {dash.layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {dash.isSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {ticker && (
            <Button variant={isTracked ? 'secondary' : 'default'} size="sm" onClick={() => toggle(ticker)}>
              {isTracked ? `Untrack ${ticker}` : `Track ${ticker}`}
            </Button>
          )}
          {editing ? (
            <Button size="sm" onClick={stopEditing}>
              <CheckIcon /> Done
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={!active}>
              <PencilIcon /> Edit layout
            </Button>
          )}
        </div>
      </div>

      {editing && active && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2 text-sm" role="toolbar" aria-label="Layout tools">
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding} disabled={active.layout.widgets.length >= MAX_WIDGETS}>
              <PlusIcon /> Add widget
            </Button>
            {adding && (
              <ul className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md" role="menu" aria-label="Widget types">
                {WIDGET_MENU.map((def) => (
                  <li key={def.type} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                      onClick={() => {
                        dash.update(addWidget(active.layout, def.type as WidgetType))
                        setAdding(false)
                      }}
                    >
                      <span className="font-medium">{def.title}</span>
                      <span className="text-xs text-muted-foreground">{def.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={createLayout}>
            <PlusIcon /> New layout
          </Button>
          <Button variant="ghost" size="sm" onClick={renameLayout}>
            <PencilIcon /> Rename
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dash.setDefault(active.id)} disabled={active.isDefault}>
            <StarIcon /> {active.isDefault ? 'Default layout' : 'Make default'}
          </Button>
          <Button variant="ghost" size="sm" onClick={deleteLayout} className="text-destructive">
            <Trash2Icon /> Delete layout
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">Drag by the title bar, resize from the corner.</span>
        </div>
      )}

      {dash.error && (
        <p role="alert" className="text-sm text-destructive">
          {dash.error}
        </p>
      )}

      {dash.isLoading ? (
        <Skeleton className="h-96 w-full" aria-busy aria-label="Loading dashboard" />
      ) : active ? (
        <DashboardGrid
          layout={active.layout}
          editing={editing}
          activeTicker={ticker}
          onGridChange={(items) => dash.update(applyGrid(active.layout, items))}
          onRemove={(id) => dash.update(removeWidget(active.layout, id))}
          onConfig={(id, patch) => dash.update(updateWidgetConfig(active.layout, id, patch))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No dashboard yet.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Tracking {tracked.length} symbol{tracked.length === 1 ? '' : 's'}
        {watchlistSource === 'cloud' ? ', synced to your account.' : ' in this browser.'}
        {dash.source === 'cloud' ? ' Layouts are saved to your account.' : ' Layouts are saved in this browser.'}
      </p>
    </section>
  )
}
