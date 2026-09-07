import { Suspense, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import GridLayout, { useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { GRID_COLS, ROW_HEIGHT, WIDGET_SIZES, isWidgetType, type DashboardLayout, type WidgetType } from '@/lib/dashboard-layout'
import { WidgetFrame } from './widgets/widget-frame'
import { UnknownWidget } from './widgets/unknown-widget'
import { resolveWidget } from './widgets/registry'

export interface DashboardGridProps {
  layout: DashboardLayout
  editing: boolean
  activeTicker: string | null
  onGridChange: (items: Layout) => void
  onRemove: (id: string) => void
  onConfig: (id: string, patch: Record<string, unknown>) => void
}

export function DashboardGrid({ layout, editing, activeTicker, onGridChange, onRemove, onConfig }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth()
  const [settingsFor, setSettingsFor] = useState<string | null>(null)

  const items: LayoutItem[] = layout.widgets.map((w) => {
    const size = isWidgetType(w.type) ? WIDGET_SIZES[w.type as WidgetType] : { minW: 2, minH: 2 }
    return { i: w.id, ...w.grid, minW: size.minW, minH: size.minH, static: !editing }
  })

  return (
    <div ref={containerRef} className="-mx-1" data-testid="dashboard-grid">
      {mounted && (
        <GridLayout
          width={width}
          layout={items}
          gridConfig={{ cols: GRID_COLS, rowHeight: ROW_HEIGHT, margin: [8, 8], containerPadding: [4, 4] }}
          dragConfig={{ enabled: editing, handle: '.widget-drag-handle', bounded: false }}
          resizeConfig={{ enabled: editing, handles: ['se'] }}
          compactor={verticalCompactor}
          onLayoutChange={(next) => editing && onGridChange(next)}
          className={editing ? 'is-editing' : undefined}
        >
          {layout.widgets.map((w) => {
            const def = resolveWidget(w.type)
            const config = w.config as never
            return (
              <div key={w.id} data-testid={`widget-${w.id}`} data-widget-type={w.type}>
                <WidgetFrame
                  title={def?.title ?? w.type}
                  subtitle={def?.subtitle?.(config, activeTicker)}
                  editing={editing}
                  settingsOpen={settingsFor === w.id}
                  onToggleSettings={() => setSettingsFor((cur) => (cur === w.id ? null : w.id))}
                  onRemove={() => onRemove(w.id)}
                  settings={
                    def ? (
                      <Suspense fallback={<Skeleton className="h-6 w-48" />}>
                        <def.Settings config={config} onChange={(patch) => onConfig(w.id, patch as Record<string, unknown>)} />
                      </Suspense>
                    ) : undefined
                  }
                >
                  {def ? (
                    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" aria-busy aria-label={`Loading ${def.title}`} />}>
                      <def.Component config={config} activeTicker={activeTicker} editing={editing} />
                    </Suspense>
                  ) : (
                    <UnknownWidget type={w.type} />
                  )}
                </WidgetFrame>
              </div>
            )
          })}
        </GridLayout>
      )}
    </div>
  )
}
