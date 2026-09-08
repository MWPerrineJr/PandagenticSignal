import {
  LAYOUT_VERSION,
  MAX_WIDGETS,
  WIDGET_TYPES,
  addWidget,
  applyGrid,
  layoutsEqual,
  parseLayout,
  parseWidgetConfig,
  removeWidget,
  serialiseLayout,
  starterLayout,
  updateWidgetConfig,
} from './dashboard-layout'

describe('dashboard layout model', () => {
  it('starter layout is valid and round-trips through JSON', () => {
    const layout = starterLayout()
    expect(layout.version).toBe(LAYOUT_VERSION)
    expect(layout.widgets.map((w) => w.type)).toEqual(['watchlist', 'chart', 'quote', 'analyst'])
    const json = serialiseLayout(layout)
    expect(parseLayout(json)).toEqual(layout)
    expect(parseLayout(JSON.parse(json))).toEqual(layout)
    expect(layoutsEqual(layout, parseLayout(json))).toBe(true)
  })

  it('fills widget config defaults and keeps unknown widget types', () => {
    const parsed = parseLayout({
      version: 1,
      widgets: [
        { id: 'a', type: 'chart', config: { symbol: 'AAPL' }, grid: { x: 0, y: 0, w: 6, h: 6 } },
        { id: 'b', type: 'heatmap', config: { foo: 1 }, grid: { x: 6, y: 0, w: 6, h: 6 } },
      ],
    })
    expect(parsed.widgets[0]!.config).toEqual({ symbol: 'AAPL', period: '6mo', interval: '1d', overlays: ['ema10', 'ema30', 'sr'] })
    expect(parsed.widgets[1]).toMatchObject({ type: 'heatmap', config: {} })
  })

  it('migrates a layout without a version field', () => {
    const parsed = parseLayout({ widgets: [{ id: 'q', type: 'quote', grid: { x: 0, y: 0, w: 4, h: 6 } }] })
    expect(parsed.version).toBe(LAYOUT_VERSION)
    expect(parsed.widgets[0]!.config).toEqual({ symbol: null })
  })

  it('rejects garbage', () => {
    expect(() => parseLayout({ version: 99, widgets: [] })).toThrow()
    expect(() => parseLayout({ version: 1, widgets: [{ id: 'x', type: 'quote', grid: { x: -1, y: 0, w: 1, h: 1 } }] })).toThrow()
    expect(() => parseLayout('not json')).toThrow()
  })

  it('parseWidgetConfig falls back to defaults on bad values', () => {
    expect(parseWidgetConfig('chart', { period: 'bogus' })).toMatchObject({ period: '6mo' })
    expect(parseWidgetConfig('watchlist', { limit: 500 })).toEqual({ limit: 10 })
    expect(parseWidgetConfig('nope', { a: 1 })).toEqual({})
  })

  it('adds widgets below existing ones and caps the count', () => {
    let layout = starterLayout()
    layout = addWidget(layout, 'compare')
    const added = layout.widgets.at(-1)!
    expect(added.type).toBe('compare')
    expect(added.grid).toMatchObject({ x: 0, y: 18, w: 8, h: 10 })
    expect(added.id).not.toBe(layout.widgets[0]!.id)
    for (const t of WIDGET_TYPES) for (let i = 0; i < 4; i++) layout = addWidget(layout, t)
    expect(layout.widgets).toHaveLength(MAX_WIDGETS)
  })

  it('removes, updates config, and applies grid positions', () => {
    let layout = starterLayout()
    layout = removeWidget(layout, 'starter-quote')
    expect(layout.widgets.map((w) => w.id)).not.toContain('starter-quote')

    layout = updateWidgetConfig(layout, 'starter-chart', { symbol: 'msft', period: '1y' })
    expect(layout.widgets.find((w) => w.id === 'starter-chart')!.config).toMatchObject({ symbol: 'msft', period: '1y', interval: '1d' })

    const moved = applyGrid(layout, [{ i: 'starter-chart', x: 0, y: 0, w: 12, h: 12 }, { i: 'ghost', x: 0, y: 0, w: 1, h: 1 }])
    expect(moved.widgets.find((w) => w.id === 'starter-chart')!.grid).toEqual({ x: 0, y: 0, w: 12, h: 12 })
    expect(moved.widgets).toHaveLength(layout.widgets.length)
    expect(applyGrid(moved, [{ i: 'starter-chart', x: 0, y: 0, w: 12, h: 12 }])).toBe(moved) // no change → same reference
  })
})
