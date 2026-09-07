import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { charts, resetCharts } from '@/test/chart-mock'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(resetCharts)

describe('ChartsPage', () => {
  it('shows an empty state without a ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts' })
    expect(await screen.findByText(/no ticker selected/i)).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Period' })).not.toBeInTheDocument()
  })

  it('loads indicators and renders the chart with controls', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=aapl' })
    await screen.findByTestId('price-chart')
    expect(charts[0]!.live('Line')).toHaveLength(7)
    expect(screen.getByRole('radio', { name: '1Y' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: /EMA 10/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/30 bars · daily/)).toBeInTheDocument()
  })

  it('period, interval and overlay controls drive requests and the chart', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${API_URL}/indicators/:symbol`, async ({ request }) => {
        seen.push(new URL(request.url).search)
        const { makeIndicators } = await import('@/test/fixtures')
        const url = new URL(request.url)
        return HttpResponse.json({
          ...makeIndicators('AAPL'),
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
    await waitFor(() => expect(seen).toContain('?period=6mo&interval=1wk'))
    expect(await screen.findByText(/weekly/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bollinger/ }))
    expect(screen.getByRole('button', { name: /Bollinger/ })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(charts[0]!.live('Line')).toHaveLength(4))
  })

  it('shows a friendly error for an unknown ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=NOPE' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no price history for NOPE/i)
  })
})
