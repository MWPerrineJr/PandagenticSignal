import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { charts, resetCharts } from '@/test/chart-mock'
import { renderWithProviders } from '@/test/render'
import { useIndicatorStore } from '@/stores/indicators'
import { AppRoutes } from '@/app/routes'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(() => {
  resetCharts()
  useIndicatorStore.getState().reset()
})

describe('ChartsPage', () => {
  it('shows an empty state without a ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts' })
    expect(await screen.findByText(/no ticker selected/i)).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Period' })).not.toBeInTheDocument()
  })

  it('loads the default indicators and renders the chart with controls', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=aapl' })
    await screen.findByTestId('price-chart')
    expect(charts[0]!.live('Line')).toHaveLength(7)
    expect(screen.getByRole('radio', { name: '1Y' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('indicator-count')).toHaveTextContent('6')
    expect(screen.getByText(/30 bars · daily · 6 indicators · selection saved in this browser/)).toBeInTheDocument()
  })

  it('period, interval and the indicator picker drive requests and the chart', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${API_URL}/indicators/AAPL`, async ({ request }) => {
        const url = new URL(request.url)
        seen.push(url.search)
        const { makeIndicators } = await import('@/test/fixtures')
        const ind = url.searchParams.get('ind')
        return HttpResponse.json({
          ...makeIndicators('AAPL', 30, ind ? ind.split(',') : undefined),
          period: url.searchParams.get('period'),
          interval: url.searchParams.get('interval'),
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/charts?t=AAPL' })
    await screen.findByTestId('price-chart')

    await user.click(screen.getByRole('radio', { name: '6M' }))
    await user.click(screen.getByRole('radio', { name: 'Weekly' }))
    await waitFor(() => expect(seen.at(-1)).toContain('period=6mo&interval=1wk'))
    expect(await screen.findByText(/weekly/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /indicators/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Indicators' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove BB 20/2' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Add indicator' }), 'rsi')
    await waitFor(() => expect(seen.at(-1)).toContain('ind=ema%3A10%2Cema%3A30%2Cema%3A60%2Cema%3A90%2Csr%2Crsi%3A14'))
    await waitFor(() => expect(charts[0]!.live('Line').filter((s) => s.paneIndex === 1)).toHaveLength(1))
    expect(screen.getByTestId('indicator-count')).toHaveTextContent('6')
    // The selection is remembered for the next visit.
    expect(useIndicatorStore.getState().tokens).toEqual(['ema:10', 'ema:30', 'ema:60', 'ema:90', 'sr', 'rsi:14'])
  })

  it('applies indicators from a shared link once and cleans the URL', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=AAPL&ind=rsi,macd:5-20' })
    await screen.findByTestId('price-chart')
    await waitFor(() => expect(useIndicatorStore.getState().tokens).toEqual(['rsi:14', 'macd:5-20-9']))
    await waitFor(() => expect(charts[0]!.paneList).toHaveLength(3))
    expect(screen.getByTestId('indicator-count')).toHaveTextContent('2')
  })

  it('shows a friendly error for an unknown ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=NOPE' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no price history for NOPE/i)
  })
})
