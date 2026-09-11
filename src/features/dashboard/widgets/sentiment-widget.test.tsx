import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { parseWidgetConfig } from '@/lib/dashboard-layout'
import { SentimentWidget, SentimentWidgetSettings } from './sentiment-widget'

describe('SentimentWidget', () => {
  it('follows the header ticker and never fetches until asked', async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.get(`${API_URL}/sentiment/MSFT`, () => {
        calls += 1
        return HttpResponse.json({
          symbol: 'MSFT',
          generated_at: 1,
          model: 'm',
          cached: false,
          news_count: 1,
          report: { overall: 'bearish', score: -0.4, confidence: 0.5, themes: ['Layoffs'], articles: [], summary: 'Grim.' },
          articles: [],
          disclaimer: 'Automated summary of news tone, not investment advice.',
        })
      }),
    )
    renderWithProviders(<SentimentWidget config={{ symbol: null }} activeTicker="MSFT" editing={false} />)
    const button = await screen.findByRole('button', { name: /^analyse$/i })
    expect(calls).toBe(0)
    await user.click(button)
    expect(await screen.findByTestId('sentiment-badge')).toHaveTextContent('Bearish')
    expect(calls).toBe(1)
  })

  it('shows the empty state without any symbol and edits its own symbol', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SentimentWidget config={{ symbol: null }} activeTicker={null} editing={false} />)
    expect(await screen.findByText(/no ticker selected/i)).toBeInTheDocument()

    expect(parseWidgetConfig('sentiment', {})).toEqual({ symbol: null })
    const onChange = vi.fn()
    renderWithProviders(<SentimentWidgetSettings config={{ symbol: null }} onChange={onChange} />)
    // Controlled by the parent, so a single keystroke is what reaches onChange here.
    await user.type(screen.getByLabelText(/symbol/i), 'n')
    expect(onChange).toHaveBeenLastCalledWith({ symbol: 'N' })
  })

  it('is hidden entirely when the server has no key', async () => {
    server.use(http.get(`${API_URL}/sentiment/status`, () => HttpResponse.json({ enabled: false })))
    renderWithProviders(<SentimentWidget config={{ symbol: 'AAPL' }} activeTicker={null} editing={false} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sentiment-disabled')).not.toBeInTheDocument()
  })
})
