import { Router } from 'express'
import { db, listCategories } from '../db/client.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'

const router = Router()

// Editable columns and how to coerce them; null clears an optional field.
const FIELDS = {
  name: (v) => String(v).trim().slice(0, 80) || 'Untitled',
  fvf_pct: (v) => Math.min(100, Math.max(0, Number(v) || 0)),
  tier_threshold: (v) => (v === '' || v == null ? null : Math.max(0, Number(v) || 0)),
  tier_pct: (v) => (v === '' || v == null ? null : Math.min(100, Math.max(0, Number(v) || 0))),
  no_per_order: (v) => (v === true || v === 'true' || v === 1 ? 1 : 0)
}

const getRow = async (id) =>
  (await db.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [id] })).rows[0]

router.get('/', async (req, res) => {
  res.send(render('categories', { title: 'Categories', nav: 'categories', categories: await listCategories() }))
})

router.post('/', async (req, res) => {
  const { lastInsertRowid } = await db.execute(
    "INSERT INTO categories (name, fvf_pct, sort) VALUES ('New category', 13.6, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories))"
  )
  const stream = sse(res)
  stream.patchElements(render('partials/category-row', { c: await getRow(Number(lastInsertRowid)) }), {
    selector: '#category-rows', mode: 'append'
  })
  stream.end()
})

router.post('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { field, value } = req.body
  const stream = sse(res)
  if (FIELDS[field]) {
    await db.execute({ sql: `UPDATE categories SET ${field} = ? WHERE id = ?`, args: [FIELDS[field](value), id] })
    const c = await getRow(id)
    if (c) stream.patchElements(render('partials/category-row', { c, saved: true }))
  }
  stream.end()
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { rows: [{ n }] } = await db.execute('SELECT COUNT(*) AS n FROM categories')
  const stream = sse(res)
  if (n > 1) {
    await db.batch([
      { sql: 'DELETE FROM categories WHERE id = ?', args: [id] },
      { sql: 'UPDATE settings SET category_id = (SELECT id FROM categories ORDER BY sort LIMIT 1) WHERE category_id = ?', args: [id] }
    ], 'write')
    stream.patchElements('', { selector: `#cat-${id}`, mode: 'remove' })
  }
  stream.end()
})

export default router
