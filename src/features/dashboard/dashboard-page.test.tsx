import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { useDashboardStore } from '@/stores/dashboard'
import { useTickerStore } from '@/stores/tickers'
import { starterLayout } from '@/lib/dashboard-layout'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(() => {
  localStorage.clear()
  useDashboardStore.getState().reset()
  useTickerStore.getState().clear()
})

const widgets = () => screen.getAllByTestId(/^widget-/)

describe('DashboardPage', () => {
  it('renders the starter layout with live widgets', async () => {
    useTickerStore.getState().add('MSFT')
    renderWithProviders(<AppRoutes />, { route: '/dashboard?t=AAPL' })
    await screen.findByTestId('dashboard-grid')
    await waitFor(() => expect(widgets()).toHaveLength(4))
    expect(screen.getByRole('region', { name: 'Quote' })).toHaveTextContent('AAPL')
    expect(await within(screen.getByRole('region', { name: 'Quote' })).findByText('$200.00')).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Watchlist' })).findByText('MSFT')).toBeInTheDocument()
    expect(await screen.findByTestId('price-chart')).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Analysts' })).findByText('Hold', { selector: '[data-slot=badge]' })).toBeInTheDocument()
  })

  it('edit mode adds, configures and removes widgets', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/dashboard?t=AAPL' })
    await waitFor(() => expect(widgets()).toHaveLength(4))
    expect(screen.queryByRole('button', { name: /remove quote widget/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit layout/i }))
    await user.click(screen.getByRole('button', { name: /add widget/i }))
    await user.click(screen.getByRole('menuitem', { name: /compare/i }))
    await waitFor(() => expect(widgets()).toHaveLength(5))
    expect(screen.getByRole('region', { name: 'Compare' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /quote settings/i }))
    const symbol = screen.getByRole('textbox', { name: /symbol/i })
    await user.type(symbol, 'msft')
    await waitFor(() => expect(screen.getByRole('region', { name: 'Quote' })).toHaveTextContent('MSFT'))
    expect(await within(screen.getByRole('region', { name: 'Quote' })).findByText('$400.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove analysts widget/i }))
    await waitFor(() => expect(widgets()).toHaveLength(4))
    expect(screen.queryByRole('region', { name: 'Analysts' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^done$/i }))
    expect(useDashboardStore.getState().layouts[0]!.layout.widgets.map((w) => w.type).sort()).toEqual(['chart', 'compare', 'quote', 'watchlist'])
  })

  it('renders a placeholder for an unknown widget type instead of crashing', async () => {
    const store = useDashboardStore.getState()
    const layout = starterLayout()
    layout.widgets.push({ id: 'x', type: 'heatmap', config: {}, grid: { x: 0, y: 20, w: 6, h: 4 } })
    store.upsert({ ...store.layouts[0]!, layout })
    renderWithProviders(<AppRoutes />, { route: '/dashboard' })
    await waitFor(() => expect(widgets()).toHaveLength(5))
    expect(screen.getByRole('note')).toHaveTextContent(/unknown widget type heatmap/i)
  })

  it('switches between named layouts', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'prompt').mockReturnValue('Second')
    renderWithProviders(<AppRoutes />, { route: '/dashboard' })
    await waitFor(() => expect(widgets()).toHaveLength(4))
    await user.click(screen.getByRole('button', { name: /edit layout/i }))
    await user.click(screen.getByRole('button', { name: /new layout/i }))
    const select = screen.getByRole('combobox', { name: 'Layout' })
    await waitFor(() => expect(select).toHaveDisplayValue('Second'))
    await user.selectOptions(select, screen.getByRole('option', { name: /my dashboard/i }))
    expect(select).toHaveDisplayValue('My dashboard (default)')
    vi.restoreAllMocks()
  })
})
