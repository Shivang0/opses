# OPSES — Design System (`design.md`)

Distilled from the two references and committed to a single bold direction. This governs the whole UI module. If a choice isn't here, choose the option that reads more **cinematic, editorial, and intentional** — never generic-SaaS.

## References → what we take
- **Creative-Agency (Aurora)** — *the landing DNA*: dark, cinematic, premium; full-bleed hero with an oversized editorial title; sectioned storytelling; refined hover + parallax + staggered page-load reveals; serif editorial accent over a clean grotesque.
- **Operator consoles** — *the dashboard DNA*: left sidebar + top bar; dense KPI cards; charts (activity/cost/donut); searchable tables; slide-over detail panels; per-entity drill-down.

## Aesthetic direction: "Cinematic editorial security"
Dark, premium, intelligence-grade — a governance console that feels like a private situation room, not a SaaS dashboard. Bold restraint: heavy negative space, one warm accent, hairline structure, and a couple of high-impact motion moments. **Dark theme throughout** (landing + dashboard) for cohesion and gravity.

**The one memorable thing:** the oversized Fraunces headline over a grained near-black field with a slow amber glow, and the "pull-the-cable / nothing leaves the building" beat.

## Typography (NO Inter/Roboto/system)
- **Display — `Fraunces`** (Google Fonts), optical serif. Hero + section titles. Weights 400/500/600; use large sizes (clamp up to ~7rem on the hero), tight leading (~0.95), `font-optical-sizing: auto`, slight negative letter-spacing.
- **UI — `Hanken Grotesk`** (Google Fonts). Body, nav, labels, table text. Weights 400/500/600.
- **Data/mono — `JetBrains Mono`**. Metrics, tokens, session IDs, code, evidence, eyebrow labels (uppercase, letter-spacing 0.12em, 12px).
- Numerals in KPIs/tables: mono, `font-variant-numeric: tabular-nums`.

## Color tokens (dark) — put in `web/src/index.css @theme`
```
--color-ink:        #0a0a0c   /* page base (near-black, faint warm) */
--color-ink-2:      #0e0f12   /* alt section band */
--color-surface:    #141418   /* cards / panels */
--color-surface-2:  #1b1c21   /* raised / hover */
--color-line:       #26262c   /* hairline borders (use at ~1px) */
--color-line-soft:  #1c1d22
--color-paper:      #f3f0e9   /* primary text — warm paper white */
--color-muted:      #a6a19a   /* secondary text (>=4.5:1 on ink) */
--color-subtle:     #726f69   /* tertiary (labels) */
--color-accent:     #e6b450   /* amber/gold — used SPARINGLY (CTAs, active, highlights) */
--color-accent-2:   #7dd3c0   /* cool mint — secondary data series only */
/* severity (tuned bright for dark bg, AA on ink/surface) */
--color-danger:     #ff6b61   --color-danger-dim: rgba(255,107,97,.14)
--color-warn:       #f5c451   --color-warn-dim:   rgba(245,196,81,.14)
--color-ok:         #58d38c   --color-ok-dim:     rgba(88,211,140,.14)
--radius: 0.75rem
```
Rules: accent is < ~8% of the surface area. Charts: axes/grid at `--color-line`, primary series `--color-accent`, secondary `--color-accent-2`, severity uses the severity tokens. No purple, no rainbow, no gradients-as-fills except the atmospheric hero glow.

## Atmosphere & detail
- **Grain**: a subtle SVG/`feTurbulence` noise overlay at ~3–4% opacity, fixed, `mix-blend-mode: overlay`, `pointer-events:none`.
- **Hero glow**: one large, soft radial (amber, very low alpha) behind the headline; optional slow drift (`@keyframes`, 20s, respect `prefers-reduced-motion`).
- **Hairlines**: 1px `--color-line` dividers; card borders 1px; avoid heavy shadows — use faint inset/ring (`box-shadow: inset 0 1px 0 rgba(255,255,255,.03)`), not drop shadows.
- **Cursor/hover**: links + cards lift subtly (`translateY(-2px)`, 200ms cubic-bezier(.2,.8,.2,1)); accent underline grows from left.

## Motion (high-impact, few)
- **Hero page-load**: staggered reveal — eyebrow → title lines (clip-path/`translateY` + opacity) → sub → CTAs, ~80–110ms stagger via `animation-delay`. One orchestrated moment.
- **Scroll reveals**: sections fade+rise on enter (IntersectionObserver, once). Keep subtle.
- All motion gated by `@media (prefers-reduced-motion: reduce)`.

## Layout
- **Landing** (dark, editorial): sticky slim nav (mono wordmark `OPSES`, hairline underline on scroll). Full-viewport hero: mono eyebrow, oversized Fraunces headline ("Governance for agentic AI — nothing leaves the building."), one sentence sub, two CTAs, an abstract CSS/SVG motif (concentric rings / signal grid — NOT stock imagery, NOT emoji). Then editorial sections with generous rhythm: the shadow-AI problem (numbered, mono indices), the pipeline (capture→mask→encrypt→relay→Gemma→cited report as a horizontal hairline diagram), the sovereignty beat (full-bleed statement), compliance frameworks (hairline cards), final CTA, minimal footer. Allow asymmetry and one grid-breaking element.
- **Dashboard** (dark, dense operator-console structure): fixed left sidebar (wordmark + nav with active amber marker), top bar (view title + "Live"/"Sample" pill + "In-house" lock pill). Content = KPI row (mono tabular numerals), charts (dark Recharts), tables (hairline rows, hover `--color-surface-2`), slide-over drill-down (right, backdrop blur, focus-trap, Esc). Density like a dense console but with more breathing room.

## Components (restyle in place — DO NOT change data wiring)
Button (primary=amber on ink text; ghost=hairline), Card (surface + 1px line + inset ring), Badge (severity dims), Stat (mono value, label, delta), Table (hairline), Sidebar (active amber bar), Meter (thin track, accent/severity fill, accessible name), SlideOver, charts. Keep all shadcn-style APIs and the `useOpses`/`api.ts` data layer intact.

## Accessibility (non-negotiable)
WCAG AA contrast on dark (verify severity/muted tokens ≥ 4.5:1 on ink & surface), visible focus rings (2px accent), semantic HTML, labelled controls + meters, keyboard nav, `prefers-reduced-motion`. Fully responsive; no horizontal overflow at 375px (tables scroll inside their own container).

## Hard "don'ts"
No Inter/Roboto/Arial/system stack. No purple/indigo gradients on white. No emoji. No generic card-grid-on-white SaaS look. No heavy drop shadows. No stock hero image. Accent used sparingly.
