import type { ReactNode } from 'react'
import { GripVerticalIcon, Settings2Icon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface WidgetFrameProps {
  title: string
  subtitle?: string
  editing: boolean
  settingsOpen?: boolean
  onToggleSettings?: () => void
  onRemove?: () => void
  settings?: ReactNode
  children: ReactNode
}

/** Card chrome shared by every widget: title bar (drag handle in edit mode), settings, body. */
export function WidgetFrame({ title, subtitle, editing, settingsOpen, onToggleSettings, onRemove, settings, children }: WidgetFrameProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground" aria-label={title}>
      <header
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 border-b px-3 text-sm',
          editing && 'widget-drag-handle cursor-grab select-none active:cursor-grabbing',
        )}
      >
        {editing && <GripVerticalIcon className="size-4 text-muted-foreground" aria-hidden />}
        <span className="font-medium">{title}</span>
        {subtitle && <span className="truncate font-mono text-xs text-muted-foreground">{subtitle}</span>}
        {editing && (
          <span className="ml-auto flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
            {settings && (
              <Button variant="ghost" size="icon-sm" aria-label={`${title} settings`} aria-pressed={settingsOpen} onClick={onToggleSettings}>
                <Settings2Icon />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${title} widget`} onClick={onRemove}>
              <XIcon />
            </Button>
          </span>
        )}
      </header>
      {editing && settingsOpen && settings && (
        <div className="shrink-0 border-b bg-muted/30 px-3 py-2 text-xs" onPointerDown={(e) => e.stopPropagation()}>
          {settings}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  )
}
