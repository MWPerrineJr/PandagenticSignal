import { SearchIcon } from 'lucide-react'

export function EmptyTicker({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <SearchIcon className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">No ticker selected</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hint ?? 'Use the search box above to pick a symbol or company. Your choice follows you across tabs.'}
      </p>
    </div>
  )
}
