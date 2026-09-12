import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ActivityIcon, LogOutIcon } from 'lucide-react'
import { DISCLAIMER_SHORT } from '@/content/disclaimer'
import { AcknowledgementBar } from '@/features/legal/acknowledgement-bar'
import { useAuth } from '@/auth/auth-provider'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/layout/user-menu'
import { TickerSearch } from '@/features/search/ticker-search'
import { useTicker } from '@/lib/use-ticker'

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/charts', label: 'Charts' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/analysts', label: 'Analysts' },
  { to: '/crypto', label: 'Crypto' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/retirement', label: 'Retirement' },
  { to: '/sentiment', label: 'Sentiment' },
  { to: '/faq', label: 'FAQ' },
] as const

export function AppShell() {
  const { search } = useLocation()
  const [ticker, setTicker] = useTicker()
  const { status, signOut } = useAuth()
  const signedIn = status === 'signed-in'

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
          <div className="flex flex-col">
            <NavLink to={{ pathname: '/', search }} className="flex items-center gap-2 font-semibold">
              <ActivityIcon className="size-5" aria-hidden />
              <span className="hidden sm:inline">Pandagentic Signal</span>
            </NavLink>
            {signedIn && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto justify-start px-0 py-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void signOut()}
              >
                <LogOutIcon className="mr-1 size-3" />
                Log out
              </Button>
            )}
          </div>
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={{ pathname: item.to, search }}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <TickerSearch value={ticker} onSelect={setTicker} className="w-64 sm:w-80" />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground">
          <span>{DISCLAIMER_SHORT}</span>
          <NavLink to="/disclaimer" className="underline underline-offset-4 hover:text-foreground">
            Disclaimer
          </NavLink>
          <NavLink to="/faq" className="underline underline-offset-4 hover:text-foreground">
            FAQ
          </NavLink>
          <span className="ml-auto">Data: Yahoo Finance · Coinbase · CoinGecko</span>
        </div>
      </footer>
      <AcknowledgementBar />
    </div>
  )
}
