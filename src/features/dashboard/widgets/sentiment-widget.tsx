import { EmptyTicker } from '@/features/empty-ticker'
import { SentimentPanel } from '@/features/sentiment/sentiment-panel'
import { SymbolField } from './settings-fields'
import type { WidgetProps, WidgetSettingsProps } from './registry'

/** Never auto-fetches: shows a cached report if one exists, otherwise a small Analyse button. */
export function SentimentWidget({ config, activeTicker }: WidgetProps<'sentiment'>) {
  const symbol = config.symbol ?? activeTicker
  if (!symbol) return <EmptyTicker hint="Pick a symbol in the header, or set one in this widget's settings." />
  return <SentimentPanel key={symbol} symbol={symbol} compact />
}

export function SentimentWidgetSettings({ config, onChange }: WidgetSettingsProps<'sentiment'>) {
  return <SymbolField id="sentiment-symbol" value={config.symbol} onChange={(symbol) => onChange({ symbol })} />
}
