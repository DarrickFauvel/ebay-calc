import express from 'express'
import { migrate } from './src/db/client.js'
import { seed } from './src/db/seed.js'
import { render } from './src/lib/views.js'
import calc from './src/routes/calc.js'
import settings from './src/routes/settings.js'
import rates from './src/routes/rates.js'
import categories from './src/routes/categories.js'

await migrate()
if (await seed()) console.log('First run: seeded rates and categories.')

const app = express()
app.disable('x-powered-by')
app.use(express.json())
app.use(express.static('public', { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }))

app.use(calc)
app.use(settings)
app.use('/rates', rates)
app.use('/categories', categories)
app.get('/offline', (req, res) => res.send(render('offline', { title: 'Offline' })))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).send(render('error', { title: 'Error', message: err.message }))
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => console.log(`listening on http://localhost:${port}`))
