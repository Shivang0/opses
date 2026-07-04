// pricing.mjs - public list prices per 1M tokens (USD), used to estimate spend
// from Claude Code / Cursor telemetry. The transcripts carry full model IDs
// (claude-opus-4-8, claude-sonnet-4-5, claude-haiku-4-5, claude-fable-5, ...),
// so we match the exact tier instead of a coarse "opus/sonnet" bucket. Anthropic
// figures track the Claude platform pricing table (Jul 2026); the non-Anthropic
// rows are public list-price estimates for the models a Cursor seat is likely to
// route to. Cache economics fold into costUSD below: cache writes bill at 1.25x
// input, cache reads at 0.1x input.

// Ordered most-specific first; first match wins. { in, out } are USD per 1M tokens.
const RATES = [
  // ---- Anthropic - Claude ----
  [/fable|mythos/,            { in: 10, out: 50 }],      // Fable 5 / Mythos 5
  [/opus-?4|opus 4/,          { in: 5, out: 25 }],       // Opus 4.0 - 4.8
  [/opus/,                    { in: 15, out: 75 }],      // Opus 3 (legacy)
  [/sonnet/,                  { in: 3, out: 15 }],       // Sonnet 3.5 - 5 (all one tier)
  [/haiku-?4|haiku 4/,        { in: 1, out: 5 }],        // Haiku 4.5
  [/3-5-haiku|haiku-?3[-.]5/, { in: 0.8, out: 4 }],      // Haiku 3.5
  [/haiku/,                   { in: 0.25, out: 1.25 }],  // Haiku 3

  // ---- OpenAI - GPT (Cursor) ----
  [/gpt-?5/,                  { in: 1.25, out: 10 }],    // GPT-5 (approx)
  [/gpt-?4\.1/,               { in: 2, out: 8 }],        // GPT-4.1 (approx)
  [/gpt-?4o|4o-mini/,         { in: 2.5, out: 10 }],     // GPT-4o family
  [/gpt-?4/,                  { in: 30, out: 60 }],      // GPT-4 (legacy)
  [/gpt-?3\.5|gpt-?35/,       { in: 0.5, out: 1.5 }],    // GPT-3.5
  [/\bo3\b|o3-|o1|o4-mini/,   { in: 15, out: 60 }],      // o-series reasoning (approx)

  // ---- Google - Gemini (Cursor) ----
  [/gemini.*flash|flash/,     { in: 0.075, out: 0.3 }],  // Gemini Flash
  [/gemini-?2|gemini 2/,      { in: 1.25, out: 10 }],    // Gemini 2.x Pro (approx)
  [/gemini/,                  { in: 1.25, out: 5 }],     // Gemini 1.5 Pro
]

// priceFor(model) -> { in, out } USD per 1M tokens. Unknown models fall back to
// the Sonnet tier, the most common mid-range rate.
export function priceFor(model = '') {
  const m = String(model).toLowerCase()
  for (const [re, rate] of RATES) if (re.test(m)) return rate
  return { in: 3, out: 15 }
}

// costUSD(model, usage) - estimate the dollar cost of one assistant turn.
//   input      = fresh prompt tokens         -> 1.00x input rate
//   cacheWrite = cache_creation_input_tokens -> 1.25x input rate
//   cacheRead  = cache_read_input_tokens     -> 0.10x input rate
//   output     = output_tokens               -> 1.00x output rate
// Back-compat: also accepts the old positional form
// costUSD(model, tokensInclCacheRead, cacheRead, output).
export function costUSD(model, usage = {}, cacheReadArg, outputArg) {
  const p = priceFor(model)
  if (typeof usage === 'number') {
    const cr = cacheReadArg || 0
    const input = Math.max(0, usage - cr)
    return (input / 1e6) * p.in + (cr / 1e6) * p.in * 0.1 + ((outputArg || 0) / 1e6) * p.out
  }
  const { input = 0, cacheWrite = 0, cacheRead = 0, output = 0 } = usage
  return (
    (input / 1e6) * p.in +
    (cacheWrite / 1e6) * p.in * 1.25 +
    (cacheRead / 1e6) * p.in * 0.1 +
    (output / 1e6) * p.out
  )
}
