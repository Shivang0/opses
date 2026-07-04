// Shared, JSX-free helpers for the CISO dashboard. Pure data mapping only -
// presentational indicators live in ./indicators.tsx.
import {
  developers,
  findings,
  type Developer,
  type Finding,
  type Severity,
} from '../../data/sample'

/** Fast id -> developer lookup. */
export const devById: Record<string, Developer> = Object.fromEntries(
  developers.map((d) => [d.id, d]),
)

/** All findings attributed to a given developer. */
export function findingsForDev(devId: string): Finding[] {
  return findings.filter((f) => f.dev === devId)
}

/** High → Medium → Low ordering weight. */
export const severityRank: Record<Severity, number> = { high: 3, medium: 2, low: 1 }
export const severityLabel: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Comparator: most severe first, then most recently detected. */
export function bySeverityThenDate(a: Finding, b: Finding): number {
  const s = severityRank[b.severity] - severityRank[a.severity]
  if (s !== 0) return s
  return b.detectedAt.localeCompare(a.detectedAt)
}

export type RiskLevel = 'high' | 'medium' | 'low'
export function riskLevel(score: number): RiskLevel {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}
export const riskLabel: Record<RiskLevel, string> = {
  high: 'High',
  medium: 'Elevated',
  low: 'Low',
}
/** Badge variant for a risk level - low risk reads as positive (green). */
export const riskBadgeVariant: Record<RiskLevel, 'high' | 'medium' | 'ok'> = {
  high: 'high',
  medium: 'medium',
  low: 'ok',
}

export type ControlStatus = 'ok' | 'at_risk' | 'monitored'
export const controlStatusMeta: Record<
  ControlStatus,
  { label: string; variant: 'ok' | 'high' | 'info' }
> = {
  ok: { label: 'On track', variant: 'ok' },
  at_risk: { label: 'At risk', variant: 'high' },
  monitored: { label: 'Monitored', variant: 'info' },
}

/** Human framework name + reference clause for each mapped control id. */
export const frameworkMeta: Record<string, { framework: string; ref: string }> = {
  'EU AI Act Art. 10': { framework: 'EU AI Act', ref: 'Article 10' },
  'ISO/IEC 42001 A.10': { framework: 'ISO/IEC 42001', ref: 'Annex A.10' },
  'NIST AI RMF MAP 3.4': { framework: 'NIST AI RMF', ref: 'MAP 3.4' },
  'NIST AI RMF GOVERN 1.1': { framework: 'NIST AI RMF', ref: 'GOVERN 1.1' },
}
export function frameworkFor(id: string): { framework: string; ref: string } {
  return frameworkMeta[id] ?? { framework: id, ref: '' }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Date + time, e.g. "Jul 4, 1:25 PM" - used for session/event timestamps. */
export function fmtDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Trim the noisy `claude-` prefix and trailing date stamp off a model id for
    compact display, e.g. "claude-opus-4-5-20251101" -> "opus-4-5". */
export function shortModel(m: string): string {
  return m.replace(/^claude-/, '').replace(/-\d{6,}$/, '')
}

/** Format an hour-of-day (0-23) as a wall-clock label, e.g. 12 -> "12:00". */
export function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}
