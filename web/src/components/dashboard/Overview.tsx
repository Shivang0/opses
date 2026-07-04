import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck, ChevronRight, DollarSign, ShieldAlert, Users } from 'lucide-react'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
} from '../ui'
import { ActivityChart } from './ActivityChart'
import { ToolSplitChart } from './ToolSplitChart'
import { ControlStatusBadge, ProgressMeter } from './indicators'
import { bySeverityThenDate, severityLabel } from './meta'
import { useOpses } from '../../lib/useOpses'
import { formatUSD } from '../../lib/utils'

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
      <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function Overview() {
  const { org, findings, controls, toolSplit, activity } = useOpses()
  const topRisks = [...findings].sort(bySeverityThenDate).slice(0, 4)
  const atRisk = controls.filter((c) => c.status === 'at_risk').length
  const toolBreakdown = toolSplit.map((t) => `${t.value} ${t.name}`).join(' · ')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Overview"
        subtitle="Organization-wide posture for agentic AI coding assistants — last 14 days."
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active developers"
          value={org.activeDevs}
          icon={<Users />}
          hint={toolBreakdown || 'No assistants detected'}
        />
        <Stat
          label="Open findings"
          value={org.openFindings}
          icon={<ShieldAlert />}
          trend="up"
          tone="negative"
          delta={`${org.bySeverity.high} high`}
          hint={`${org.bySeverity.medium} medium · ${org.bySeverity.low} low`}
        />
        <Stat
          label="Compliance score"
          value={
            <>
              {org.complianceScore}
              <span className="text-lg font-medium text-subtle">/100</span>
            </>
          }
          icon={<BadgeCheck />}
          hint={`${atRisk} of ${controls.length} controls at risk`}
        />
        <Stat
          label="Cost MTD"
          value={formatUSD(org.costMTD)}
          icon={<DollarSign />}
          hint={`Across ${org.activeDevs} developer${org.activeDevs === 1 ? '' : 's'}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Usage &amp; spend</CardTitle>
              <CardDescription>Org-wide tokens and estimated cost per day.</CardDescription>
            </div>
            <div className="hidden shrink-0 items-center gap-4 sm:flex">
              <LegendItem color="var(--color-primary)" label="Tokens (M)" />
              <LegendItem color="var(--color-ink-soft)" label="Spend ($)" />
            </div>
          </CardHeader>
          <CardContent>
            <ActivityChart data={activity} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Tool adoption</CardTitle>
            <CardDescription>Assistants in use across the org.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToolSplitChart data={toolSplit} />
          </CardContent>
        </Card>
      </div>

      {/* Risks + compliance snapshot */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Top risks</CardTitle>
              <CardDescription>Highest-severity open findings.</CardDescription>
            </div>
            <Link
              to="/dashboard/findings"
              className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              View all <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="-mx-2 divide-y divide-border">
              {topRisks.map((f) => (
                <li key={f.id}>
                  <Link
                    to={`/dashboard/findings?finding=${f.id}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <Badge variant={f.severity}>{severityLabel[f.severity]}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{f.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {f.devName} · {f.control}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>Compliance posture</CardTitle>
            <Link
              to="/dashboard/compliance"
              className="rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Details
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-mono text-sm text-ink">
                  {org.complianceScore}
                  <span className="text-muted">/100</span>
                </span>
                <span className="text-xs text-muted">Target 90</span>
              </div>
              <ProgressMeter value={org.complianceScore} label="Compliance score" />
            </div>
            <ul className="space-y-2.5">
              {controls.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{c.label}</span>
                    <span className="block truncate font-mono text-xs text-subtle">{c.id}</span>
                  </span>
                  <ControlStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
