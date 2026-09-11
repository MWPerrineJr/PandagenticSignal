import { BriefcaseIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import type { Portfolio } from '@/lib/portfolio'
import { Button } from '@/components/ui/button'

export interface PortfolioPickerProps {
  portfolios: Portfolio[]
  active: Portfolio | null
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

/** Select + new/rename/delete, mirroring the dashboard layout tools. */
export function PortfolioPicker({ portfolios, active, onSelect, onCreate, onRename, onRemove }: PortfolioPickerProps) {
  const create = () => {
    const name = window.prompt('Name for the new portfolio', `Portfolio ${portfolios.length + 1}`)
    if (name) onCreate(name)
  }
  const rename = () => {
    if (!active) return
    const name = window.prompt('Rename portfolio', active.name)
    if (name && name !== active.name) onRename(active.id, name)
  }
  const remove = () => {
    if (active && window.confirm(`Delete “${active.name}”? This cannot be undone.`)) onRemove(active.id)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="toolbar" aria-label="Portfolio tools">
      {active && (
        <label className="flex items-center gap-2">
          <BriefcaseIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Portfolio</span>
          <select aria-label="Portfolio" className="h-8 rounded-md border bg-background px-2 text-sm" value={active.id} onChange={(e) => onSelect(e.target.value)}>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button variant="ghost" size="sm" onClick={create}>
        <PlusIcon /> New
      </Button>
      <Button variant="ghost" size="sm" onClick={rename} disabled={!active}>
        <PencilIcon /> Rename
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={!active} className="text-destructive">
        <Trash2Icon /> Delete
      </Button>
    </div>
  )
}
