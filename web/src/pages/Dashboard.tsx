import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import Overview from '../components/dashboard/Overview'
import Developers from '../components/dashboard/Developers'
import Findings from '../components/dashboard/Findings'
import Compliance from '../components/dashboard/Compliance'
import { OpsesProvider } from '../lib/useOpses'

// CISO console. Mounted at /dashboard/* by App.tsx; nested routes render inside
// the shared DashboardLayout (sidebar + top bar) via <Outlet/>. The OpsesProvider
// wraps the whole console so every view + the header share one live data source
// (with graceful fallback to the bundled sample dataset).
export default function Dashboard() {
  return (
    <OpsesProvider>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="developers" element={<Developers />} />
          <Route path="findings" element={<Findings />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </OpsesProvider>
  )
}
