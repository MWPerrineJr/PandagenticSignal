import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { useAuth } from '@/auth/auth-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { WatchlistPage } from '@/features/watchlist/watchlist-page'
import { AnalystsPage } from '@/features/analysts/analysts-page'
import { LoginPage } from '@/features/auth/login-page'

// The chart library is the heaviest dependency; only load it when the tab is opened.
const ChartsPage = lazy(() => import('@/features/charts/charts-page').then((m) => ({ default: m.ChartsPage })))
const CryptoPage = lazy(() => import('@/features/crypto/crypto-page').then((m) => ({ default: m.CryptoPage })))
const PortfolioPage = lazy(() => import('@/features/portfolio/portfolio-page').then((m) => ({ default: m.PortfolioPage })))
const SentimentPage = lazy(() => import('@/features/sentiment/sentiment-page').then((m) => ({ default: m.SentimentPage })))
const FaqPage = lazy(() => import('@/features/faq/faq-page').then((m) => ({ default: m.FaqPage })))
const DisclaimerPage = lazy(() => import('@/features/legal/disclaimer-page').then((m) => ({ default: m.DisclaimerPage })))
const RetirementPage = lazy(() => import('@/features/retirement/retirement-page').then((m) => ({ default: m.RetirementPage })))

function PageFallback() {
  return <Skeleton className="h-[480px] w-full" aria-busy aria-label="Loading page" />
}

/** A signed-in account that has not confirmed the disclosure is sent back to the login page. */
function DisclosureGate() {
  const { status, disclosureAccepted } = useAuth()
  if (status === 'signed-in' && disclosureAccepted === false) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LoginPage />} />
        <Route element={<DisclosureGate />}>
        <Route path="dashboard" element={<DashboardPage />} />
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
        <Route
          path="sentiment"
          element={
            <Suspense fallback={<PageFallback />}>
              <SentimentPage />
            </Suspense>
          }
        />
        <Route
          path="faq"
          element={
            <Suspense fallback={<PageFallback />}>
              <FaqPage />
            </Suspense>
          }
        />
        <Route
          path="disclaimer"
          element={
            <Suspense fallback={<PageFallback />}>
              <DisclaimerPage />
            </Suspense>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
