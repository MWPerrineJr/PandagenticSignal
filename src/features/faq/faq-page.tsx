import { Link } from 'react-router-dom'
import { useIndicatorCatalog } from '@/lib/queries'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ENDPOINTS, FAQ_SECTIONS, seconds, type FaqEntry } from '@/content/faq'
import { DISCLAIMER_SHORT } from '@/content/disclaimer'

/** Renders `code` spans written with backticks in the content strings. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1 font-mono text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function Entry({ entry }: { entry: FaqEntry }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">{entry.q}</h3>
      {entry.a.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          <Rich text={p} />
        </p>
      ))}
    </div>
  )
}

function EndpointTable() {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="API endpoints">
        <TableHeader>
          <TableRow>
            <TableHead>Endpoint</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Cached</TableHead>
            <TableHead>Limit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ENDPOINTS.map((e) => (
            <TableRow key={`${e.method} ${e.path}`} data-testid={`endpoint-${e.path}`}>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                <Badge variant="outline" className="mr-2">
                  {e.method}
                </Badge>
                {e.path}
              </TableCell>
              <TableCell className="text-sm">{e.purpose}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.cache.length ? e.cache.map((c) => `${c.what} ${seconds(c.seconds)}`).join(' · ') : '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{e.rate_limit ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function IndicatorCatalog() {
  const { data, isPending, isError } = useIndicatorCatalog()
  if (isPending) return <Skeleton className="h-40 w-full" aria-busy aria-label="Loading indicator catalog" />
  if (isError) return <p className="text-sm text-muted-foreground">The indicator catalog could not be loaded right now.</p>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="Indicator definitions">
        <TableHeader>
          <TableRow>
            <TableHead>Indicator</TableHead>
            <TableHead>Defaults</TableHead>
            <TableHead>Formula</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.indicators.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-sm">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.kind === 'overlay' ? 'overlay' : 'own pane'} · {s.description}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {s.params.length ? s.params.map((p) => `${p.name} ${p.default}`).join(', ') : '—'}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{s.formula}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function FaqPage() {
  return (
    <section aria-labelledby="faq-heading" className="space-y-8">
      <div className="space-y-2">
        <h1 id="faq-heading" className="text-2xl font-semibold">
          FAQ
        </h1>
        <p className="text-sm text-muted-foreground">
          How the tool works, where its numbers come from, how stale they can be, and what its models assume.{' '}
          {DISCLAIMER_SHORT}{' '}
          <Link to="/disclaimer" className="underline underline-offset-4">
            Read the full disclaimer.
          </Link>
        </p>
        <nav aria-label="FAQ sections" className="flex flex-wrap gap-2 text-sm">
          {FAQ_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground">
              {s.title}
            </a>
          ))}
        </nav>
      </div>

      {FAQ_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`faq-${section.id}`} className="scroll-mt-20 space-y-4">
          <h2 id={`faq-${section.id}`} className="text-lg font-semibold">
            {section.title}
          </h2>
          {section.intro && (
            <p className="text-sm text-muted-foreground">
              <Rich text={section.intro} />
            </p>
          )}
          {section.entries.map((entry) => (
            <Entry key={entry.q} entry={entry} />
          ))}
          {section.id === 'endpoints' && <EndpointTable />}
          {section.id === 'assumptions' && (
            <div className="space-y-2">
              <h3 className="font-medium">Indicator catalog</h3>
              <IndicatorCatalog />
            </div>
          )}
        </section>
      ))}
    </section>
  )
}
