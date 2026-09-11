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
const CryptoPage = lazy(() => import('@/features/crypto/crypto-page').then((m) => ({ default: m.CryptoPage })))
const PortfolioPage = lazy(() => import('@/features/portfolio/portfolio-page').then((m) => ({ default: m.PortfolioPage })))
const RetirementPage = lazy(() => import('@/features/retirement/retirement-page').then((m) => ({ default: m.RetirementPage })))

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
        <Route
          path="crypto"
          element={
            <Suspense fallback={<PageFallback />}>
              <CryptoPage />
            </Suspense>
          }
        />
        <Route path="analysts" element={<AnalystsPage />} />
        <Route
          path="portfolio"
          element={
            <Suspense fallback={<PageFallback />}>
              <PortfolioPage />
            </Suspense>
          }
        />
        <Route
          path="retirement"
          element={
            <Suspense fallback={<PageFallback />}>
              <RetirementPage />
            </Suspense>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
