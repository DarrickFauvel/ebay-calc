import { Eta } from 'eta'

const eta = new Eta({
  views: new URL('../../views', import.meta.url).pathname,
  cache: process.env.NODE_ENV === 'production'
})

export const usd = (n) => (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2)
export const pct = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`
export const weight = (oz) => {
  const lb = Math.floor(oz / 16)
  const rem = Math.round((oz - lb * 16) * 1000) / 1000
  return [lb && `${lb} lb`, rem && `${rem} oz`].filter(Boolean).join(' ') || '0 oz'
}

const helpers = { usd, pct, weight }

export const render = (name, data = {}) => eta.render(name, { ...helpers, ...data })
