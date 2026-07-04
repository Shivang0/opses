// Approx public list prices per 1M tokens (USD). Cache reads billed ~0.1x input.
// Used only to estimate spend from token counts.
export function priceFor(model = '') {
  const m = String(model).toLowerCase()
  if (m.includes('opus')) return { in: 15, out: 75 }
  if (m.includes('sonnet')) return { in: 3, out: 15 }
  if (m.includes('haiku')) return { in: 0.8, out: 4 }
  if (m.includes('fable')) return { in: 3, out: 15 }
  if (m.includes('gpt-4o')) return { in: 2.5, out: 10 }
  if (m.includes('gpt-4')) return { in: 30, out: 60 }
  if (m.startsWith('o1') || m.includes('o1-') || m.includes('o3')) return { in: 15, out: 60 }
  if (m.includes('gemini')) return { in: 1.25, out: 5 }
  return { in: 3, out: 15 } // sensible default
}

export function costUSD(model, tokensIn, cacheRead, tokensOut) {
  const p = priceFor(model)
  const billableIn = Math.max(0, tokensIn - cacheRead)
  return (billableIn / 1e6) * p.in + (cacheRead / 1e6) * p.in * 0.1 + (tokensOut / 1e6) * p.out
}
