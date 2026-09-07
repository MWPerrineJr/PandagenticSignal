import { render, screen } from '@testing-library/react'
import { WIDGET_TYPES } from '@/lib/dashboard-layout'
import { WIDGET_MENU, WIDGET_REGISTRY, resolveWidget } from './registry'
import { UnknownWidget } from './unknown-widget'

describe('widget registry', () => {
  it('resolves every widget type with a component, settings and size', () => {
    for (const type of WIDGET_TYPES) {
      const def = resolveWidget(type)
      expect(def, type).not.toBeNull()
      expect(def!.type).toBe(type)
      // Plain function components or React.lazy objects (chart-based widgets load on demand).
      expect(['function', 'object']).toContain(typeof def!.Component)
      expect(['function', 'object']).toContain(typeof def!.Settings)
      expect(def!.size.w).toBeGreaterThan(0)
      expect(def!.title).toBeTruthy()
    }
    expect(WIDGET_MENU.map((d) => d.type)).toEqual([...WIDGET_TYPES])
  })

  it('returns null for an unknown type and renders a placeholder', () => {
    expect(resolveWidget('heatmap')).toBeNull()
    render(<UnknownWidget type="heatmap" />)
    expect(screen.getByRole('note')).toHaveTextContent(/unknown widget type heatmap/i)
  })

  it('subtitles follow the header ticker unless the widget pins a symbol', () => {
    expect(WIDGET_REGISTRY.quote.subtitle!({ symbol: null }, 'AAPL')).toBe('AAPL')
    expect(WIDGET_REGISTRY.quote.subtitle!({ symbol: 'MSFT' }, 'AAPL')).toBe('MSFT')
    expect(WIDGET_REGISTRY.compare.subtitle!({ symbols: [], period: '6mo' }, null)).toBe('tracked symbols')
  })
})
