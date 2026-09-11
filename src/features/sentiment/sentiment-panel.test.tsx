import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { makeSentiment } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { ScoreBar, SentimentPanel } from './sentiment-panel'

describe('SentimentPanel', () => {
  it('shows nothing (or a note) when the server has no key', async () => {
    server.use(http.get(`${API_URL}/sentiment/status`, () => HttpResponse.json({ enabled: false, model: null })))
    const { rerender } = renderWithProviders(<SentimentPanel symbol="AAPL" showDisabledNote />)
    expect(await screen.findByTestId('sentiment-disabled')).toHaveTextContent(/not enabled/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    rerender(<SentimentPanel symbol="AAPL" />)
    expect(screen.queryByTestId('sentiment-disabled')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('fetches only on click, then renders the report, articles and disclaimer', async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.get(`${API_URL}/sentiment/AAPL`, () => {
        calls += 1
        return HttpResponse.json(makeSentiment('AAPL'))
      }),
    )
    renderWithProviders(<SentimentPanel symbol="AAPL" />)
    const button = await screen.findByRole('button', { name: /analyse news sentiment/i })
    expect(calls).toBe(0)

    await user.click(button)
    expect(await screen.findByTestId('sentiment-result')).toBeInTheDocument()
    expect(calls).toBe(1)
    const badges = screen.getAllByTestId('sentiment-badge')
    expect(badges[0]).toHaveTextContent('Bullish') // overall
    expect(screen.getByTestId('sentiment-confidence')).toHaveTextContent('70% confidence')
    expect(screen.getByRole('img', { name: 'Tone score +0.60' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Themes' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByTestId('sentiment-summary')).toHaveTextContent(/broadly positive/)

    const articles = screen.getByRole('list', { name: 'Articles' })
    const items = within(articles).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]!).getByRole('link', { name: /apple beats/i })).toHaveAttribute('href', 'https://example.com/apple-beats')
    expect(within(items[1]!).getByTestId('sentiment-badge')).toHaveTextContent('Bearish')
    expect(within(items[2]!).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('sentiment-footer')).toHaveTextContent('not investment advice')
    expect(screen.getByTestId('sentiment-footer')).toHaveTextContent('3 articles')
  })

  it('compact mode hides the article list and marks cached reports', async () => {
    const user = userEvent.setup()
    server.use(http.get(`${API_URL}/sentiment/AAPL`, () => HttpResponse.json(makeSentiment('AAPL', { cached: true }))))
    renderWithProviders(<SentimentPanel symbol="AAPL" compact />)
    await user.click(await screen.findByRole('button', { name: /^analyse$/i }))
    expect(await screen.findByTestId('sentiment-result')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Articles' })).not.toBeInTheDocument()
    expect(screen.getByTestId('sentiment-footer')).toHaveTextContent('cached')
  })

  it('explains a rate limit and offers a retry', async () => {
    const user = userEvent.setup()
    let attempt = 0
    server.use(
      http.get(`${API_URL}/sentiment/AAPL`, () => {
        attempt += 1
        return attempt === 1
          ? HttpResponse.json({ detail: 'Rate limit exceeded: 10 per 1 minute' }, { status: 429 })
          : HttpResponse.json(makeSentiment('AAPL'))
      }),
    )
    renderWithProviders(<SentimentPanel symbol="AAPL" />)
    await user.click(await screen.findByRole('button', { name: /analyse news sentiment/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many analyses/i)
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByTestId('sentiment-result')).toBeInTheDocument()
  })

  it('reports no news without calling it an error', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_URL}/sentiment/MSFT`, () => HttpResponse.json(makeSentiment('MSFT', { report: null, articles: [], news_count: 0 }))),
    )
    renderWithProviders(<SentimentPanel symbol="MSFT" />)
    await user.click(await screen.findByRole('button', { name: /analyse news sentiment/i }))
    expect(await screen.findByText(/no recent news found for MSFT/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ScoreBar labels negative scores and clamps', () => {
    renderWithProviders(<ScoreBar score={-3} />)
    expect(screen.getByRole('img', { name: 'Tone score −1.00' })).toBeInTheDocument()
  })
})
