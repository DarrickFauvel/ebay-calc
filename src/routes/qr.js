import { Router } from 'express'
import QRCode from 'qrcode'

const router = Router()

// QR code (SVG) for a page URL, so the app can be opened on a phone by scanning.
router.get('/qr.svg', async (req, res) => {
  // Encode the string as given: new URL() would re-add a trailing slash to a bare origin.
  const u = String(req.query.u ?? '')
  if (!URL.canParse(u) || !/^https?:$/.test(new URL(u).protocol) || u.length > 2000) {
    return res.status(400).send('Bad URL')
  }
  const svg = await QRCode.toString(u, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg)
})

export default router
