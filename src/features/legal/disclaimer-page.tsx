import { Link } from 'react-router-dom'
import { DISCLAIMER_SECTIONS, DISCLAIMER_SHORT, DISCLAIMER_UPDATED } from '@/content/disclaimer'

export function DisclaimerPage() {
  return (
    <section aria-labelledby="disclaimer-heading" className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 id="disclaimer-heading" className="text-2xl font-semibold">
          Disclaimer
        </h1>
        <p className="text-sm font-medium">{DISCLAIMER_SHORT}</p>
        <p className="text-xs text-muted-foreground">
          Last updated {DISCLAIMER_UPDATED}. Questions about data sources and model assumptions are answered in the{' '}
          <Link to="/faq" className="underline underline-offset-4">
            FAQ
          </Link>
          .
        </p>
      </div>
      {DISCLAIMER_SECTIONS.map((s) => (
        <section key={s.title} aria-labelledby={`disc-${s.title}`} className="space-y-2">
          <h2 id={`disc-${s.title}`} className="text-lg font-semibold">
            {s.title}
          </h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </section>
  )
}
