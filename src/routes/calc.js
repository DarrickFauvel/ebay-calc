import { Router } from 'express'
import { getLastInputs, getSettings, listCategories, saveLastInputs } from '../db/client.js'
import { parseInputs, quote } from '../lib/quote.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'

const router = Router()

router.get('/', async (req, res) => {
  const [settings, categories, last] = await Promise.all([getSettings(), listCategories(), getLastInputs()])
  // Number inputs get string signals: Datastar writes a number signal back into its
  // input on every keystroke ("01.99" → "1.99"), which moves the cursor to the end.
  const signals = {
    cost: String(last?.cost ?? 5),
    lb: String(last?.lb ?? 0),
    oz: String(last?.oz ?? 12),
    length: String(last?.length ?? 0),
    width: String(last?.width ?? 0),
    height: String(last?.height ?? 0),
    categoryId: settings.category_id ?? categories[0]?.id,
    taxPct: String(settings.tax_pct),
    mode: last?.mode ?? 'profit',
    targetProfit: String(last?.target_profit ?? 10),
    listPrice: String(last?.list_price ?? 0),
    // eBay's label price (filled by the extension) and ship-to ZIP survive a reload too; 0 means none.
    labelCost: last?.label_cost ? String(last.label_cost) : '',
    shipZip: last?.ship_zip ?? '',
    taxZip: '',
    media: false
  }
  const q = await quote(signals, settings)
  res.send(render('index', { title: 'Calculator', nav: 'calc', settings, categories, signals, q }))
})

router.post('/calc', async (req, res) => {
  const settings = await getSettings()
  const q = await quote(req.body, settings)
  // Checking a price sets the target profit to what that price earns.
  const targetProfit = q.result && q.input.mode === 'price' ? q.result.profit.toFixed(2) : null
  await remember({ ...req.body, ...(targetProfit && { targetProfit }) })
  const stream = sse(res)
  stream.patchElements(render('partials/results', { q, settings }))
  stream.patchElements(render('partials/peek', { q }))
  // Seed the "list price" box with the solved price when switching modes.
  if (q.result && q.input.mode === 'profit') stream.patchSignals({ listPrice: q.result.price.toFixed(2) })
  if (targetProfit) stream.patchSignals({ targetProfit })
  if (q.taxFill) stream.patchSignals({ ...q.taxFill, taxPct: String(q.taxFill.taxPct) })
  stream.patchElements(render('partials/ship-to', { dest: q.dest }))
  stream.end()
})

// Keep the last mode, prices, cost, weight, box size, ship-to ZIP and label cost so the next visit starts from them.
function remember (signals = {}) {
  const { cost, targetProfit, length, width, height, mode, listPrice, shipZip, labelCost } = parseInputs(signals)
  const lb = Math.max(0, Math.floor(Number(signals.lb) || 0))
  const oz = Math.max(0, Number(signals.oz) || 0)
  return saveLastInputs({ cost, targetProfit, lb, oz, length, width, height, mode, listPrice, shipZip, labelCost })
}

export default router
