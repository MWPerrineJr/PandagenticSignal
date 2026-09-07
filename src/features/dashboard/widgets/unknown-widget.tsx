import { CircleHelpIcon } from 'lucide-react'

/** Rendered for a widget type this build does not know (e.g. a layout saved by a newer version). */
export function UnknownWidget({ type }: { type: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground" role="note">
      <CircleHelpIcon className="size-6" aria-hidden />
      <p>
        Unknown widget type <code className="font-mono">{type}</code>. It is kept in the layout; remove it in edit mode if it is no
        longer needed.
      </p>
    </div>
  )
}
