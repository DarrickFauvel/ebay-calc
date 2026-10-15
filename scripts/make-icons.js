// Renders the app icon (a white parcel on blue) to PNG without dependencies.
// Usage: npm run icons
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

// Point-in-polygon for the parcel shape (coordinates in a 64-unit box).
const inside = (x, y, pts) => {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const distToSeg = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax; const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const BLUE = [0x1d, 0x4e, 0xd8]
const WHITE = [0xff, 0xff, 0xff]
const box = [[14, 24], [32, 15], [50, 24], [50, 44], [32, 53], [14, 44]]
const lines = [[[14, 24], [32, 33]], [[32, 33], [50, 24]], [[32, 33], [32, 53]], [[23, 19.5], [41, 28.5]], [[41, 28.5], [41, 35.5]]]

function render (size, { maskable = false } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  // Maskable icons keep content inside the central 80% safe zone.
  const scale = maskable ? 0.72 : 1
  const radius = maskable ? 0 : 14
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 64; const v = ((y + 0.5) / size) * 64
      const cu = 32 + (u - 32) / scale; const cv = 32 + (v - 32) / scale
      // Rounded-rect background
      const qx = Math.max(radius - u, 0, u - (64 - radius)); const qy = Math.max(radius - v, 0, v - (64 - radius))
      const inBg = radius === 0 || Math.hypot(qx, qy) <= radius
      let color = BLUE; let alpha = inBg ? 255 : 0
      if (inBg && inside(cu, cv, box) && !lines.some(([a, b]) => distToSeg(cu, cv, a, b) < 1.25)) color = WHITE
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = color[0]; raw[o + 1] = color[1]; raw[o + 2] = color[2]; raw[o + 3] = alpha
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ])
}

const out = new URL('../public/icons/', import.meta.url)
writeFileSync(new URL('icon-192.png', out), render(192))
writeFileSync(new URL('icon-512.png', out), render(512))
writeFileSync(new URL('icon-maskable-512.png', out), render(512, { maskable: true }))
console.log('Wrote icons to public/icons/')
