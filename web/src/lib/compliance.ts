// Compliance engine - the shared brain behind every Gemma-powered governance
// feature (Compliance page, Reports, Copilot, Digest). Pure logic + prompt
// builders here; the on-device model call goes through runGemma() in ./api.
//
// It maps the four real finding kinds OPSES derives (pii_leak, hook_exfil,
// mcp_bloat, claudemd_bloat) onto concrete controls across three frameworks,
// derives a status per control, scores overall posture, and assembles the
// prompts fed to the local model. Everything is grounded in captured evidence.
import type { FindingKind } from '../data/sample'
import type { OrgView, ViewFinding } from './useOpses'
import type { ControlStatus } from '../components/dashboard/meta'
import { runGemma, type ApiAnalytics, type GemmaResult } from './api'

export type FrameworkName = 'EU AI Act' | 'ISO/IEC 42001' | 'NIST AI RMF'

export interface ComplianceControl {
  id: string
  framework: FrameworkName
  ref: string // 'Art. 10', 'A.10', 'MAP 3.4'
  title: string
  description: string
  /** Finding kinds that count as evidence against this control. */
  evidenceKinds: FindingKind[]
  /** Controls OPSES satisfies structurally (logging, lifecycle, policy) - no findings needed. */
  positive?: boolean
}

export interface Framework {
  name: FrameworkName
  blurb: string
  controls: ComplianceControl[]
}

export const FRAMEWORKS: Framework[] = [
  {
    name: 'EU AI Act',
    blurb: 'Deployer obligations under Regulation (EU) 2024/1689.',
    controls: [
      { id: 'euaiact-art10', framework: 'EU AI Act', ref: 'Art. 10', title: 'Data and data governance', description: 'Keep sensitive and personal data out of AI systems without controls.', evidenceKinds: ['pii_leak'] },
      { id: 'euaiact-art12', framework: 'EU AI Act', ref: 'Art. 12', title: 'Record-keeping and logging', description: 'Automatically record AI system events across the lifecycle.', evidenceKinds: [], positive: true },
      { id: 'euaiact-art14', framework: 'EU AI Act', ref: 'Art. 14', title: 'Human oversight', description: 'Humans can oversee and intervene in automated AI actions.', evidenceKinds: ['hook_exfil'] },
      { id: 'euaiact-art15', framework: 'EU AI Act', ref: 'Art. 15', title: 'Accuracy, robustness and cybersecurity', description: 'Resist misuse and unauthorised data flows from AI tooling.', evidenceKinds: ['hook_exfil'] },
    ],
  },
  {
    name: 'ISO/IEC 42001',
    blurb: 'AI management system (AIMS) Annex A controls.',
    controls: [
      { id: 'iso-a7', framework: 'ISO/IEC 42001', ref: 'A.7', title: 'Data for AI systems', description: 'Govern the data used with AI systems.', evidenceKinds: ['pii_leak'] },
      { id: 'iso-a9', framework: 'ISO/IEC 42001', ref: 'A.9', title: 'Use of AI systems', description: 'Responsible, resource-efficient operational use of AI.', evidenceKinds: ['mcp_bloat', 'claudemd_bloat'] },
      { id: 'iso-a10', framework: 'ISO/IEC 42001', ref: 'A.10', title: 'Third-party and supplier relationships', description: 'Control third-party tools and supply-chain integrations.', evidenceKinds: ['hook_exfil', 'mcp_bloat'] },
      { id: 'iso-a6', framework: 'ISO/IEC 42001', ref: 'A.6', title: 'AI system lifecycle', description: 'Track versions and changes across the AI tooling lifecycle.', evidenceKinds: [], positive: true },
    ],
  },
  {
    name: 'NIST AI RMF',
    blurb: 'AI Risk Management Framework core functions.',
    controls: [
      { id: 'nist-govern', framework: 'NIST AI RMF', ref: 'GOVERN 1.1', title: 'Policies and accountability', description: 'Documented policy and accountable oversight of AI use.', evidenceKinds: [], positive: true },
      { id: 'nist-map', framework: 'NIST AI RMF', ref: 'MAP 3.4', title: 'Inventory and resource use', description: 'Inventory AI tools and use context and tokens efficiently.', evidenceKinds: ['mcp_bloat', 'claudemd_bloat'] },
      { id: 'nist-measure', framework: 'NIST AI RMF', ref: 'MEASURE 2.7', title: 'Security and resilience', description: 'Measure security exposure created by AI tooling.', evidenceKinds: ['hook_exfil'] },
      { id: 'nist-manage', framework: 'NIST AI RMF', ref: 'MANAGE 2.2', title: 'Risk response', description: 'Prioritise and respond to identified AI risks.', evidenceKinds: ['pii_leak', 'hook_exfil'] },
    ],
  },
]

export const ALL_CONTROLS: ComplianceControl[] = FRAMEWORKS.flatMap((f) => f.controls)

export interface ControlEval {
  control: ComplianceControl
  findings: ViewFinding[]
  status: ControlStatus // 'ok' | 'monitored' | 'at_risk'
}

/** Status: at_risk if a high finding maps here, monitored if any map, ok otherwise. */
export function evaluateControl(control: ComplianceControl, findings: ViewFinding[]): ControlEval {
  if (control.positive) return { control, findings: [], status: 'ok' }
  const matched = findings.filter((f) => control.evidenceKinds.includes(f.kind))
  const status: ControlStatus = matched.some((f) => f.severity === 'high')
    ? 'at_risk'
    : matched.length > 0
      ? 'monitored'
      : 'ok'
  return { control, findings: matched, status }
}

export function evaluateControls(
  findings: ViewFinding[],
  frameworks: FrameworkName[] = FRAMEWORKS.map((f) => f.name),
): ControlEval[] {
  return ALL_CONTROLS.filter((c) => frameworks.includes(c.framework)).map((c) =>
    evaluateControl(c, findings),
  )
}

const STATUS_WEIGHT: Record<ControlStatus, number> = { ok: 1, monitored: 0.6, at_risk: 0.2 }

export interface Posture {
  score: number
  ok: number
  monitored: number
  atRisk: number
  total: number
}

export function posture(evals: ControlEval[]): Posture {
  const total = evals.length || 1
  const sum = evals.reduce((s, e) => s + STATUS_WEIGHT[e.status], 0)
  return {
    score: Math.round((sum / total) * 100),
    ok: evals.filter((e) => e.status === 'ok').length,
    monitored: evals.filter((e) => e.status === 'monitored').length,
    atRisk: evals.filter((e) => e.status === 'at_risk').length,
    total: evals.length,
  }
}

// ---------------------------------------------------------------------------
// Prompt builders - every string here is grounded in real captured evidence.
// ---------------------------------------------------------------------------
export function orgContext(
  org: OrgView,
  findings: ViewFinding[],
  analytics?: ApiAnalytics | null,
): string {
  const kinds = new Map<string, number>()
  findings.forEach((f) => kinds.set(f.kind, (kinds.get(f.kind) ?? 0) + 1))
  const kindStr = [...kinds].map(([k, n]) => `${k} x${n}`).join(', ') || 'none'
  const models =
    analytics?.models
      ?.filter((m) => m.tokens > 0)
      .slice(0, 4)
      .map((m) => m.model)
      .join(', ') || 'n/a'
  return [
    `Org snapshot: ${org.activeDevs} developer(s) using coding agents, $${org.costMTD.toFixed(0)} estimated spend this month, ${(org.tokensMTD / 1e6).toFixed(1)}M tokens.`,
    `Open findings: ${org.openFindings} (${org.bySeverity.high} high, ${org.bySeverity.medium} medium, ${org.bySeverity.low} low). Kinds: ${kindStr}.`,
    `Models in use: ${models}. Current compliance score: ${org.complianceScore}/100.`,
  ].join(' ')
}

export function controlPrompt(evalItem: ControlEval, org: OrgView): string {
  const { control, findings, status } = evalItem
  const evidence = control.positive
    ? 'Evidence: OPSES continuously captures and masks every agent session on-device, giving standing records for this control.'
    : findings.length
      ? `Evidence: ${findings.length} open finding(s) map here - ${findings
          .slice(0, 4)
          .map((f) => `${f.severity}: ${f.title}`)
          .join('; ')}.`
      : 'Evidence: no findings map to this control in the current scan.'
  return `Control: ${control.framework} ${control.ref} - ${control.title}. ${control.description} Assessed status: ${status}. ${evidence} Org context: ${org.activeDevs} developer(s), ${org.openFindings} open findings (${org.bySeverity.high} high).`
}

// ---------------------------------------------------------------------------
// On-device model calls - each returns { text, source } (source 'gemma' when the
// local model answered, 'fallback' when it is not running).
// ---------------------------------------------------------------------------
export function assessControl(evalItem: ControlEval, org: OrgView): Promise<GemmaResult> {
  return runGemma('compliance_control', controlPrompt(evalItem, org))
}

export function summarizePosture(
  org: OrgView,
  findings: ViewFinding[],
  evals: ControlEval[],
  analytics?: ApiAnalytics | null,
): Promise<GemmaResult> {
  const p = posture(evals)
  return runGemma(
    'compliance_summary',
    `${orgContext(org, findings, analytics)} Control posture: ${p.ok} on track, ${p.monitored} monitored, ${p.atRisk} at risk across ${p.total} controls (${p.score}/100).`,
  )
}

export function generateDigest(
  org: OrgView,
  findings: ViewFinding[],
  evals: ControlEval[],
  analytics?: ApiAnalytics | null,
  period = 'this week',
): Promise<GemmaResult> {
  const p = posture(evals)
  return runGemma(
    'compliance_digest',
    `Reporting period: ${period}. No prior baseline on file. ${orgContext(org, findings, analytics)} Control posture: ${p.atRisk} at risk, ${p.monitored} monitored, ${p.ok} on track (${p.score}/100).`,
  )
}

export function askCompliance(
  question: string,
  org: OrgView,
  findings: ViewFinding[],
  evals: ControlEval[],
  analytics?: ApiAnalytics | null,
): Promise<GemmaResult> {
  const atRisk =
    evals
      .filter((e) => e.status === 'at_risk')
      .map((e) => `${e.control.framework} ${e.control.ref} (${e.control.title})`)
      .join('; ') || 'none'
  const findingList =
    findings
      .slice(0, 8)
      .map((f) => `${f.severity} ${f.kind}: ${f.title}`)
      .join('; ') || 'none'
  const ctx = `${orgContext(org, findings, analytics)} Controls at risk: ${atRisk}. Findings: ${findingList}.`
  return runGemma('compliance_qa', `Evidence: ${ctx}\n\nQuestion: ${question}\n\nAnswer:`)
}

export const SUGGESTED_QUESTIONS: string[] = [
  'Are we compliant with EU AI Act Article 10?',
  'What is our single biggest AI-governance risk right now?',
  'Which controls are at risk, and why?',
  'Do we satisfy record-keeping and logging requirements?',
  'What should the CISO fix first?',
]
