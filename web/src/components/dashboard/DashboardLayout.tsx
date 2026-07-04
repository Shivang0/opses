import { useEffect, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  Bot,
  CreditCard,
  Database,
  FileDown,
  FileText,
  FolderKanban,
  GitCompare,
  LayoutDashboard,
  FileStack,
  Gauge,
  LineChart,
  Lock,
  Menu,
  MessageSquare,
  Plug,
  Radio,
  Receipt,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { Sidebar, SidebarItem } from '../ui'
import { cn } from '../../lib/utils'
import { useOpses } from '../../lib/useOpses'

interface NavEntry {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}
interface NavGroup {
  heading: string
  items: NavEntry[]
}

const NAV: NavGroup[] = [
  {
    heading: 'Analytics',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard />, end: true },
      { to: '/dashboard/sessions', label: 'Sessions', icon: <MessageSquare /> },
      { to: '/dashboard/costs', label: 'Costs', icon: <Receipt /> },
      { to: '/dashboard/projects', label: 'Projects', icon: <FolderKanban /> },
      { to: '/dashboard/analytics', label: 'Deep Analysis', icon: <LineChart /> },
      { to: '/dashboard/compare', label: 'Compare', icon: <GitCompare /> },
    ],
  },
  {
    heading: 'Oversight',
    items: [
      { to: '/dashboard/developers', label: 'Developers', icon: <Users /> },
      { to: '/dashboard/findings', label: 'Findings', icon: <ShieldAlert /> },
      { to: '/dashboard/mcps', label: 'MCP Registry', icon: <Server /> },
      { to: '/dashboard/context', label: 'Context Files', icon: <FileStack /> },
      { to: '/dashboard/posture', label: 'Posture', icon: <Gauge /> },
      { to: '/dashboard/compliance', label: 'Compliance', icon: <BadgeCheck /> },
      { to: '/dashboard/reports', label: 'Reports', icon: <FileText /> },
      { to: '/dashboard/evidence-query', label: 'Evidence Query', icon: <Database /> },
      { to: '/dashboard/evidence-pack', label: 'Evidence Pack', icon: <FileDown /> },
      { to: '/dashboard/copilot', label: 'Copilot', icon: <Bot /> },
    ],
  },
  {
    heading: 'Connect',
    items: [
      { to: '/dashboard/subscriptions', label: 'Subscriptions', icon: <CreditCard /> },
      { to: '/dashboard/connections', label: 'Connections', icon: <Plug /> },
      { to: '/dashboard/relay', label: 'Relay', icon: <Radio /> },
      { to: '/dashboard/settings', label: 'Data controls', icon: <Settings2 /> },
    ],
  },
]

const NAV_ITEMS = NAV.flatMap((g) => g.items)

function titleForPath(path: string): string {
  const match = NAV_ITEMS.filter((i) => (i.end ? path === i.to : path.startsWith(i.to))).sort(
    (a, b) => b.to.length - a.to.length,
  )[0]
  return match?.label ?? 'Dashboard'
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent">
        <ShieldCheck className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="font-mono text-sm font-semibold tracking-[0.2em] text-paper">OPSES</p>
        <p className="text-xs text-subtle">Agent intelligence</p>
      </div>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-5">
      {NAV.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <p className="mono-eyebrow px-3 pb-1">{group.heading}</p>
          {group.items.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              end={item.end}
              icon={item.icon}
              label={item.label}
              onClick={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="mono-eyebrow">Tenant</p>
      <p className="mt-1 text-xs font-semibold text-paper">Cerebral Valley</p>
      <p className="mt-0.5 text-xs text-subtle">Self-hosted deployment</p>
    </div>
  )
}

function SecurePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
      <Lock className="size-3.5 text-accent" aria-hidden="true" />
      <span className="hidden sm:inline">In-house - nothing leaves the building</span>
      <span className="sm:hidden">In-house</span>
    </span>
  )
}

/** Live-connection indicator - green dot when streaming from the server, a muted
    pill when rendering from the bundled sample dataset. */
function ConnectionPill() {
  const { status } = useOpses()
  if (status === 'live') {
    return (
      <span
        title="Streaming live data from the in-house server"
        className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/15 px-2.5 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.1em] text-ok"
      >
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
          <span className="relative inline-flex size-2 rounded-full bg-ok" />
        </span>
        Live
      </span>
    )
  }
  return (
    <span
      title={
        status === 'loading' ? 'Connecting to the server...' : 'Server unreachable - showing sample data'
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.1em] text-muted"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-subtle" />
      {status === 'loading' ? 'Connecting' : 'Sample data'}
    </span>
  )
}

export default function DashboardLayout() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className="flex min-h-screen bg-ink text-paper">
      {/* Desktop rail */}
      <Sidebar className="sticky top-0 hidden h-screen lg:flex">
        <div className="shrink-0">
          <Brand />
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="opses-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            <NavLinks />
          </div>
          <div className="shrink-0 pt-3">
            <SidebarFooter />
          </div>
        </div>
      </Sidebar>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 overflow-hidden lg:hidden',
          navOpen ? '' : 'pointer-events-none',
        )}
        aria-hidden={navOpen ? undefined : true}
        inert={navOpen ? undefined : true}
      >
        <div
          onClick={() => setNavOpen(false)}
          className={cn(
            'absolute inset-0 bg-ink/60 backdrop-blur-sm transition-opacity duration-300',
            navOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 transition-transform duration-300 ease-out',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar role="dialog" aria-modal="true" aria-label="Navigation" className="h-full">
            <div className="flex shrink-0 items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-paper"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <div className="opses-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
                <NavLinks onNavigate={() => setNavOpen(false)} />
              </div>
              <div className="shrink-0 pt-3">
                <SidebarFooter />
              </div>
            </div>
          </Sidebar>
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink/80 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-paper lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 truncate font-display text-lg font-medium tracking-tight text-paper">
            {titleForPath(location.pathname)}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ConnectionPill />
            <SecurePill />
          </div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
