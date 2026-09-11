import { useTicker } from '@/lib/use-ticker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyTicker } from '@/features/empty-ticker'
import { SentimentPanel } from './sentiment-panel'

export function SentimentPage() {
  const [ticker] = useTicker()

  return (
    <section aria-labelledby="sentiment-heading" className="space-y-6">
      <h1 id="sentiment-heading" className="text-2xl font-semibold">
        Sentiment{ticker && <span className="ml-2 font-mono text-muted-foreground">{ticker}</span>}
      </h1>

      {!ticker ? (
        <EmptyTicker hint="Pick a symbol to get an AI summary of the tone of its recent news coverage." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>News tone for {ticker}</CardTitle>
            <CardDescription>
              Claude reads the latest Yahoo Finance headlines and classifies each one as bullish, neutral or bearish for this
              symbol. One analysis per symbol per hour; results are shared with the dashboard widget and the Crypto tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SentimentPanel key={ticker} symbol={ticker} showDisabledNote />
          </CardContent>
        </Card>
      )}
    </section>
  )
}
