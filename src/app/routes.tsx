import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { WatchlistPage } from '@/features/watchlist/watchlist-page'
import { AnalystsPage } from '@/features/analysts/analysts-page'
import { LoginPage } from '@/features/auth/login-page'

// The chart library is the heaviest dependency; only load it when the tab is opened.
const ChartsPage = lazy(() => import('@/features/charts/charts-page').then((m) => ({ default: m.ChartsPage })))

function PageFallback() {
  return <Skeleton className="h-[480px] w-full" aria-busy aria-label="Loading page" />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route
          path="charts"
          element={
            <Suspense fallback={<PageFallback />}>
              <ChartsPage />
            </Suspense>
          }
        />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="analysts" element={<AnalystsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
