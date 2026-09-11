/**
 * Legal disclosure text. A starting draft written for this project; it is not legal advice and
 * should be reviewed by a lawyer before the site is offered to the public.
 */
export const DISCLAIMER_UPDATED = '2026-09-11'

export const DISCLAIMER_SHORT = 'Not investment advice. Information only; invest at your own risk.'

export interface DisclaimerSection {
  title: string
  paragraphs: string[]
}

export const DISCLAIMER_SECTIONS: DisclaimerSection[] = [
  {
    title: 'No investment advice',
    paragraphs: [
      'Pandagentic Signal ("the tool") is provided for general information and educational purposes only. Nothing on this site, in its charts, indicators, statistics, projections, AI-generated summaries or any other output constitutes investment, financial, legal, tax or accounting advice, and nothing here is a recommendation, offer or solicitation to buy, sell or hold any security, cryptocurrency or other asset.',
      'The tool does not know your financial situation, objectives or risk tolerance. Any investment decision you make while using it is yours alone. Consult a licensed financial adviser before acting on anything you see here.',
    ],
  },
  {
    title: 'Invest at your own risk',
    paragraphs: [
      'Investing involves risk, including the possible loss of the entire amount invested. Cryptocurrencies are especially volatile and may be unregulated where you live. You are solely responsible for evaluating the merits and risks of any decision and for the outcome of that decision.',
      'Past performance is not indicative of future results. Simulations, projections and retirement estimates are hypothetical illustrations based on historical data and simplified assumptions; they do not predict or guarantee any outcome and will differ, possibly greatly, from what actually happens.',
    ],
  },
  {
    title: 'No warranty on data',
    paragraphs: [
      'Market data, news, analyst information and rankings are obtained from third parties (Yahoo Finance, Coinbase, CoinGecko and others) that we do not control. Data may be delayed, incomplete, inaccurate or interrupted, and is subject to those providers\' terms. We make no representation or warranty, express or implied, as to the accuracy, completeness, timeliness or fitness for any purpose of any content, and we may change or withdraw features at any time.',
    ],
  },
  {
    title: 'AI-generated content',
    paragraphs: [
      'The news-sentiment feature uses a large language model to summarise the tone of published headlines. Its output is automated, may be wrong or out of date, reflects the headlines it was given rather than any independent judgement, and is not an opinion about any company, asset or price. Do not rely on it.',
    ],
  },
  {
    title: 'Limitation of liability',
    paragraphs: [
      'To the fullest extent permitted by law, the operator of this tool and its contributors will not be liable for any direct, indirect, incidental, consequential or other loss or damage, including lost profits or trading losses, arising from or in connection with your use of, or reliance on, the tool or its content, even if advised of the possibility of such damage.',
    ],
  },
  {
    title: 'Acceptance',
    paragraphs: [
      'By using the tool you acknowledge that you have read and understood this disclosure and agree to use the tool at your own risk. If you do not agree, do not use the tool.',
    ],
  },
]
