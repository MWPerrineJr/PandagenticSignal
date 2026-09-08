import { QuoteCard } from '@/features/quote/quote-card'
import { EmptyTicker } from '@/features/empty-ticker'
import { SymbolField } from './settings-fields'
import type { WidgetProps, WidgetSettingsProps } from './registry'

export function QuoteWidget({ config, activeTicker }: WidgetProps<'quote'>) {
  const symbol = config.symbol ?? activeTicker
  if (!symbol) return <EmptyTicker hint="Pick a symbol in the header, or set one in this widget's settings." />
  return <QuoteCard symbol={symbol} className="h-full rounded-none border-0 shadow-none" />
}

export function QuoteWidgetSettings({ config, onChange }: WidgetSettingsProps<'quote'>) {
  return <SymbolField id="quote-symbol" value={config.symbol} onChange={(symbol) => onChange({ symbol })} />
}
