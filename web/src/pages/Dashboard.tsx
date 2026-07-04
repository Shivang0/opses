import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import Overview from '../components/dashboard/Overview'
import Sessions from '../components/dashboard/Sessions'
import Costs from '../components/dashboard/Costs'
import Projects from '../components/dashboard/Projects'
import ProjectDetail from '../components/dashboard/ProjectDetail'
import Analytics from '../components/dashboard/Analytics'
import Compare from '../components/dashboard/Compare'
import Developers from '../components/dashboard/Developers'
import Findings from '../components/dashboard/Findings'
import McpRegistry from '../components/dashboard/McpRegistry'
import ContextFiles from '../components/dashboard/ContextFiles'
import Posture from '../components/dashboard/Posture'
import Compliance from '../components/dashboard/Compliance'
import Settings from '../components/dashboard/Settings'
import Reports from '../components/dashboard/Reports'
import Copilot from '../components/dashboard/Copilot'
import EvidenceQuery from '../components/dashboard/EvidenceQuery'
import EvidencePack from '../components/dashboard/EvidencePack'
import Subscriptions from '../components/dashboard/Subscriptions'
import Connections from '../components/dashboard/Connections'
import Relay from '../components/dashboard/Relay'
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
          <Route path="sessions" element={<Sessions />} />
          <Route path="costs" element={<Costs />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/detail" element={<ProjectDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="compare" element={<Compare />} />
          <Route path="developers" element={<Developers />} />
          <Route path="findings" element={<Findings />} />
          <Route path="mcps" element={<McpRegistry />} />
          <Route path="context" element={<ContextFiles />} />
          <Route path="posture" element={<Posture />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="reports" element={<Reports />} />
          <Route path="copilot" element={<Copilot />} />
          <Route path="evidence-query" element={<EvidenceQuery />} />
          <Route path="evidence-pack" element={<EvidencePack />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="connections" element={<Connections />} />
          <Route path="relay" element={<Relay />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </OpsesProvider>
  )
}
