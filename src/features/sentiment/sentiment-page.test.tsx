import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'

describe('SentimentPage', () => {
  it('shows the empty state without a ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/sentiment' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Sentiment' })).toBeInTheDocument()
    expect(await screen.findByText(/no ticker selected/i)).toBeInTheDocument()
  })

  it('analyses the header ticker on demand', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/sentiment?t=aapl' })
    expect(await screen.findByRole('heading', { level: 1, name: /Sentiment\s*AAPL/ })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /analyse news sentiment/i }))
    expect(await screen.findByTestId('sentiment-result')).toBeInTheDocument()
    expect(screen.getAllByTestId('sentiment-badge')[0]).toHaveTextContent('Bullish')
  })

  it('is reachable from the nav', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/?t=AAPL' })
    await user.click(await screen.findByRole('link', { name: 'Sentiment' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Sentiment\s*AAPL/ })).toBeInTheDocument()
  })
})
