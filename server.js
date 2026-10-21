import { readdir, readFile } from 'node:fs/promises'
import express from 'express'
import { migrate } from './src/db/client.js'
import { seed } from './src/db/seed.js'
import { checkIfStale } from './src/lib/rate-updates.js'
import { render } from './src/lib/views.js'
import { writeZip } from './src/lib/zip.js'
import calc from './src/routes/calc.js'
import settings from './src/routes/settings.js'
import rates from './src/routes/rates.js'
import categories from './src/routes/categories.js'
import qr from './src/routes/qr.js'

await migrate()
if (await seed()) console.log('First run: seeded rates and categories.')

const app = express()
app.disable('x-powered-by')
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public', { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }))

app.use(calc)
app.use(settings)
app.use('/rates', rates)
app.use('/categories', categories)
app.use(qr)
// The Chrome extension folder as a zip, unpacked into ship-pad-extension/ for "Load unpacked".
app.get('/extension.zip', async (req, res) => {
  const dir = new URL('./extension/', import.meta.url)
  const names = await readdir(dir)
  const files = await Promise.all(names.map(async (name) => ({ name: `ship-pad-extension/${name}`, data: await readFile(new URL(name, dir)) })))
  res.attachment('ship-pad-extension.zip').type('application/zip').send(writeZip(files))
})
app.get('/offline', (req, res) => res.send(render('offline', { title: 'Offline' })))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).send(render('error', { title: 'Error', message: err.message }))
})

const port = Number(process.env.PORT) || 3000
// Check USPS for new rates on boot, then hourly; each run only fetches if the last check is a day old.
const checkRates = () => checkIfStale().then((s) => {
  if (!s) return
  if (s.check_error) console.warn('USPS rate check failed:', s.check_error)
  else if (s.pending_id) console.log(`New USPS rates available: ${s.pending_label}`)
})

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`)
  checkRates()
  setInterval(checkRates, 60 * 60 * 1000).unref()
})
