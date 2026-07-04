// Evidence Pack - a dated compliance snapshot the CISO exports for auditors.
// Composes a self-contained SVG "evidence card" from live governance data
// (org KPIs + posture grades + findings) and downloads it as PNG (client-side
// canvas) or SVG. Reframes the share-card technique for governance output, not
// social sharing - the card is an audit artifact, and nothing leaves the
// building: the SVG is fully inline (no external fonts or assets), and the PNG
// is rasterized locally in the browser.
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, FileCode2, ImageDown, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getOrg, getPosture, getFindings, type ApiPostureProject } from '../../lib/api'

const TENANT = 'Cerebral Valley'

// ---------------------------------------------------------------------------
// Evidence card geometry + palette. The card is self-contained, so every colour
// is an inline literal and both font stacks are system faces (no @font-face).
// ---------------------------------------------------------------------------
const CARD_W = 1000
const CARD_H = 620
const PAD = 48

// OPSES palette (the card's own ink, not the app CSS tokens).
const INK = '#14110c'
const PAPER = '#f2ede3'
const AMBER = '#e6b450'
const MINT = '#7dd3c0'
const RED = '#e0876a'
// Warm neutrals derived from the palette for the card's surfaces + secondary text.
const SURFACE = '#1d1912'
const LINE = '#38311f'
const MUTED = '#cbc3b2'
const SUBTLE = '#928a7a'

const FONT_SERIF = "Georgia, 'Times New Roman', serif"
const FONT_MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** XML-escape any interpolated text so live data can never break the markup. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function fmtCompact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
/** Human stamp, e.g. "Jul 5, 2026 14:32". ASCII only; takes a Date (never calls new Date() itself). */
function formatStamp(dt: Date): string {
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
}
function toIsoDate(dt: Date): string {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

function scoreColor(score: number): string {
  if (score >= 80) return MINT
  if (score >= 60) return AMBER
  return RED
}

function gradeColor(grade: ApiPostureProject['grade']): string {
  switch (grade) {
    case 'A':
    case 'B':
      return MINT
    case 'D':
      return AMBER
    default:
      return RED
  }
}

// ---------------------------------------------------------------------------
// SVG builder - returns the full evidence-card markup as a template string.
// ---------------------------------------------------------------------------
interface EvidenceRepo {
  project: string
  grade: ApiPostureProject['grade']
  score: number
}

interface CardData {
  tenant: string
  stamp: string
  seats: number
  complianceScore: number
  openFindings: number
  bySeverity: { high: number; medium: number; low: number }
  costMTD: number
  tokensMTD: number
  findingsCount: number
  reposGraded: number
  repos: EvidenceRepo[]
}

function buildEvidenceSvg(d: CardData): string {
  const innerW = CARD_W - PAD * 2

  // ---- Header band: eyebrow, title, and a compliance-score ring, top-right ----
  const scoreCol = scoreColor(d.complianceScore)
  const ringCx = CARD_W - PAD - 30
  const ringCy = 56
  const ringR = 28
  const circ = 2 * Math.PI * ringR
  const dash = Math.max(0, Math.min(1, d.complianceScore / 100)) * circ
  const header = `
    <rect x="0" y="0" width="${CARD_W}" height="6" fill="${AMBER}"/>
    <text x="${PAD}" y="46" font-family="${FONT_MONO}" font-size="12.5" letter-spacing="2.5" fill="${AMBER}">OPSES // IN-HOUSE AI GOVERNANCE</text>
    <text x="${PAD}" y="84" font-family="${FONT_SERIF}" font-size="29" font-weight="600" fill="${PAPER}">${esc(d.tenant)} - AI Governance Evidence Pack</text>
    <g transform="rotate(-90 ${ringCx} ${ringCy})">
      <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="${LINE}" stroke-width="8"/>
      <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="${scoreCol}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}"/>
    </g>
    <text x="${ringCx}" y="${ringCy + 5}" text-anchor="middle" font-family="${FONT_MONO}" font-size="16" font-weight="700" fill="${PAPER}">${d.complianceScore}</text>
    <line x1="${PAD}" y1="104" x2="${CARD_W - PAD}" y2="104" stroke="${LINE}" stroke-width="1"/>
  `

  // ---- KPI tiles ----
  const top = 128
  const tileH = 150
  const gap = 18
  const tileW = (innerW - gap * 3) / 4
  const tiles: { label: string; value: string; valueCol: string; hint?: string; severity?: boolean }[] = [
    { label: 'ACTIVE SEATS', value: fmtInt(d.seats), valueCol: PAPER, hint: 'developers under governance' },
    { label: 'COMPLIANCE SCORE', value: `${d.complianceScore}/100`, valueCol: scoreCol, hint: 'weighted control coverage' },
    { label: 'OPEN FINDINGS', value: fmtInt(d.openFindings), valueCol: d.openFindings > 0 ? AMBER : MINT, severity: true },
    { label: 'EST. SPEND MTD', value: fmtMoney(d.costMTD), valueCol: PAPER, hint: `${fmtCompact(d.tokensMTD)} tokens month-to-date` },
  ]
  const kpi = tiles
    .map((t, i) => {
      const x = PAD + i * (tileW + gap)
      const foot = t.severity
        ? `<text x="${x + 18}" y="${top + tileH - 22}" font-family="${FONT_MONO}" font-size="12">` +
          `<tspan fill="${RED}">${d.bySeverity.high} high</tspan>` +
          `<tspan fill="${SUBTLE}"> / </tspan>` +
          `<tspan fill="${AMBER}">${d.bySeverity.medium} med</tspan>` +
          `<tspan fill="${SUBTLE}"> / </tspan>` +
          `<tspan fill="${MINT}">${d.bySeverity.low} low</tspan>` +
          `</text>`
        : `<text x="${x + 18}" y="${top + tileH - 22}" font-family="${FONT_MONO}" font-size="12" fill="${SUBTLE}">${esc(t.hint ?? '')}</text>`
      return `
      <rect x="${x}" y="${top}" width="${tileW}" height="${tileH}" rx="14" fill="${SURFACE}" stroke="${LINE}"/>
      <text x="${x + 18}" y="${top + 30}" font-family="${FONT_MONO}" font-size="11" letter-spacing="1.5" fill="${SUBTLE}">${esc(t.label)}</text>
      <text x="${x + 18}" y="${top + 88}" font-family="${FONT_MONO}" font-size="30" font-weight="700" fill="${t.valueCol}">${esc(t.value)}</text>
      ${foot}`
    })
    .join('')

  // ---- Frameworks strip ----
  const pillTop = 336
  const pillH = 34
  const frameworks = ['EU AI Act', 'ISO 42001', 'NIST AI RMF']
  let fx = PAD
  const pills = frameworks
    .map((name) => {
      const w = Math.round(name.length * 7.9) + 52
      const cx = fx + 18
      const cy = pillTop + pillH / 2
      const seg = `
      <rect x="${fx}" y="${pillTop}" width="${w}" height="${pillH}" rx="${pillH / 2}" fill="${AMBER}" fill-opacity="0.10" stroke="${AMBER}" stroke-opacity="0.45"/>
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="${AMBER}"/>
      <text x="${cx + 14}" y="${cy + 4.5}" font-family="${FONT_MONO}" font-size="13" fill="${PAPER}">${esc(name)}</text>`
      fx += w + 14
      return seg
    })
    .join('')
  const fwBlock = `
    <text x="${PAD}" y="322" font-family="${FONT_MONO}" font-size="11" letter-spacing="1.5" fill="${SUBTLE}">FRAMEWORKS IN SCOPE</text>
    <text x="${CARD_W - PAD}" y="${pillTop + 22}" text-anchor="end" font-family="${FONT_MONO}" font-size="12" fill="${SUBTLE}">${d.findingsCount} findings on file / ${d.reposGraded} repos graded</text>
    ${pills}
  `

  // ---- Lowest-graded repositories ----
  const rowY0 = 418
  const rowH = 30
  const badgeW = 28
  const trackX = 430
  const trackW = 430
  const repoHead = `<text x="${PAD}" y="402" font-family="${FONT_MONO}" font-size="11" letter-spacing="1.5" fill="${SUBTLE}">LOWEST-GRADED REPOSITORIES</text>`
  const repoRows =
    d.repos.length === 0
      ? `<text x="${PAD}" y="${rowY0 + 20}" font-family="${FONT_MONO}" font-size="13" fill="${MUTED}">No repositories graded yet.</text>`
      : d.repos
          .map((r, i) => {
            const y = rowY0 + i * rowH
            const col = gradeColor(r.grade)
            const clamped = Math.max(0, Math.min(100, r.score))
            const fillW = Math.max(4, Math.round((trackW * clamped) / 100))
            const name = r.project.length > 40 ? `${r.project.slice(0, 39)}...` : r.project
            return `
      <rect x="${PAD}" y="${y + 2}" width="${badgeW}" height="24" rx="6" fill="${col}" fill-opacity="0.14" stroke="${col}" stroke-opacity="0.5"/>
      <text x="${PAD + badgeW / 2}" y="${y + 18}" text-anchor="middle" font-family="${FONT_SERIF}" font-size="15" font-weight="700" fill="${col}">${esc(r.grade)}</text>
      <text x="${PAD + badgeW + 12}" y="${y + 19}" font-family="${FONT_MONO}" font-size="13.5" fill="${PAPER}">${esc(name)}</text>
      <rect x="${trackX}" y="${y + 10}" width="${trackW}" height="8" rx="4" fill="${LINE}"/>
      <rect x="${trackX}" y="${y + 10}" width="${fillW}" height="8" rx="4" fill="${col}"/>
      <text x="${CARD_W - PAD}" y="${y + 19}" text-anchor="end" font-family="${FONT_MONO}" font-size="13.5" fill="${MUTED}">${r.score}</text>`
          })
          .join('')

  // ---- Footer ----
  const footer = `
    <line x1="${PAD}" y1="${CARD_H - 60}" x2="${CARD_W - PAD}" y2="${CARD_H - 60}" stroke="${LINE}" stroke-width="1"/>
    <text x="${PAD}" y="${CARD_H - 30}" font-family="${FONT_MONO}" font-size="12.5" fill="${SUBTLE}">Generated ${esc(d.stamp)} - In-house - Nothing leaves the building</text>
    <text x="${CARD_W - PAD}" y="${CARD_H - 30}" text-anchor="end" font-family="${FONT_MONO}" font-size="12.5" letter-spacing="1.5" fill="${AMBER}">OPSES // OFFLINE</text>
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="${esc(d.tenant)} AI Governance Evidence Pack">
    <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${INK}"/>
    ${header}
    ${kpi}
    ${fwBlock}
    ${repoHead}
    ${repoRows}
    ${footer}
  </svg>`
}

// ---------------------------------------------------------------------------
// Download helpers - all client-side, no libraries.
// ---------------------------------------------------------------------------
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

// Rasterize the SVG onto a 2x canvas and download a PNG. Rejects on any failure
// so the caller can fall back to an SVG download.
function downloadPng(svg: string, filename: string, scale = 2): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = CARD_W * scale
        canvas.height = CARD_H * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('2D canvas context unavailable'))
          return
        }
        ctx.fillStyle = INK
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        canvas.toBlob((out) => {
          if (out) {
            triggerDownload(out, filename)
            resolve()
          } else {
            reject(new Error('canvas.toBlob returned null'))
          }
        }, 'image/png')
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err instanceof Error ? err : new Error('PNG render failed'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG image failed to load'))
    }
    img.src = url
  })
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
interface EvidencePackProps {
  /** Optional fixed generation stamp. When omitted, it is computed once on mount. */
  date?: string
}

export default function EvidencePack({ date }: EvidencePackProps = {}) {
  const orgQ = useFetch(getOrg)
  const postureQ = useFetch(getPosture)
  const findingsQ = useFetch(getFindings)

  // Timestamp is computed once on mount (never at module scope) so the card and
  // its filename share one stable "generated at" moment.
  const [stamp, setStamp] = useState(date ?? '')
  const [fileDate, setFileDate] = useState('')
  useEffect(() => {
    const now = new Date()
    setStamp(date ?? formatStamp(now))
    setFileDate(toIsoDate(now))
  }, [date])

  const [exporting, setExporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const org = orgQ.data
  const posture = postureQ.data
  const findings = findingsQ.data ?? []
  const loading = orgQ.status === 'loading' || postureQ.status === 'loading' || findingsQ.status === 'loading'

  const worstRepos = useMemo<EvidenceRepo[]>(() => {
    if (!posture) return []
    return [...posture.projects]
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map((p) => ({ project: p.project, grade: p.grade, score: p.score }))
  }, [posture])

  const svg = useMemo(() => {
    if (!org || !posture) return ''
    return buildEvidenceSvg({
      tenant: TENANT,
      stamp: stamp || 'just now',
      seats: org.activeDevs,
      complianceScore: org.complianceScore,
      openFindings: org.openFindings,
      bySeverity: org.bySeverity,
      costMTD: org.costMTD,
      tokensMTD: org.tokensMTD,
      findingsCount: findings.length,
      reposGraded: posture.summary.projects,
      repos: worstRepos,
    })
  }, [org, posture, findings.length, stamp, worstRepos])

  const baseName = `opses-evidence-pack-${fileDate || 'snapshot'}`
  const refetchAll = () => {
    orgQ.refetch()
    postureQ.refetch()
    findingsQ.refetch()
  }

  const onSvg = () => {
    if (svg) downloadSvg(svg, `${baseName}.svg`)
  }
  const onPng = async () => {
    if (!svg) return
    setExporting(true)
    setNote(null)
    try {
      await downloadPng(svg, `${baseName}.png`)
    } catch {
      // Fall back to the SVG so the CISO still walks away with an artifact.
      downloadSvg(svg, `${baseName}.svg`)
      setNote('PNG export was blocked by the browser, so the SVG was downloaded instead.')
    } finally {
      setExporting(false)
    }
  }

  const ready = Boolean(org && posture)
  const header = (
    <PageHeader
      eyebrow="Console"
      title="Evidence Pack"
      subtitle="A dated, self-contained compliance snapshot to export for auditors. Rendered locally - nothing leaves the building."
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={refetchAll} disabled={loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={onSvg} disabled={!ready || !svg}>
            <FileCode2 className="size-4" aria-hidden="true" />
            Download SVG
          </Button>
          <Button size="sm" onClick={onPng} disabled={!ready || !svg || exporting}>
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageDown className="size-4" aria-hidden="true" />
            )}
            Download PNG
          </Button>
        </>
      }
    />
  )

  if (loading && !ready) {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Assembling the evidence pack...
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          The evidence pack is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {header}

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="min-w-0">
            <CardTitle>Evidence card</CardTitle>
            <CardDescription>
              A self-contained snapshot built from live governance data. Export as PNG or SVG for the
              audit file.
            </CardDescription>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-xs text-accent sm:inline-flex">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            In-house
          </span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-line bg-ink p-3 sm:p-4">
            <div
              className="mx-auto w-full max-w-[1000px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              /* Markup is built entirely from our own template + XML-escaped live data. */
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
          <p className="mt-3 font-mono text-xs text-subtle">
            Self-contained SVG - no external fonts or assets. The PNG is rasterized locally in your
            browser.
          </p>
          {note && <p className="mt-2 text-xs text-warn">{note}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
