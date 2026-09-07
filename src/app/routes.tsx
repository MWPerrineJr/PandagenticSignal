import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ChartsPage } from '@/features/charts/charts-page'
import { WatchlistPage } from '@/features/watchlist/watchlist-page'
import { AnalystsPage } from '@/features/analysts/analysts-page'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="charts" element={<ChartsPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="analysts" element={<AnalystsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
