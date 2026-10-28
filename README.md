# Ship Pad — Price, comp and list on eBay without losing money on shipping

A desktop web app and Chrome extension for pricing eBay listings with **free shipping baked in**. It prices every item as if it ships to the **furthest lower-48 zone from your ZIP**, so you never lose money on a long-distance sale. It also accounts for eBay's final value fee, the per-order fee, and the fact that eBay charges fees **on the sales tax and on the shipping portion of your price**.

- **Hit a target profit**: enter cost, weight and profit → get the list price (plus a `.99` charm price).
- **Check a list price**: enter a price → see profit, margin and where every dollar goes.
- **Compare a real order**: enter its **Ship to ZIP** to price USPS at that destination's zone (from the USPS zone chart for your origin) instead of the worst case. The buyer's state base tax rate is filled in; add any local tax from the order. UPS stays at your worst zone.
- **Shipping pad**: shows how much of the price is covering shipping. It's always more than the label cost, because fees apply to the pad too.

## Stack

| Layer | Tech |
| --- | --- |
| Server | Node ≥ 22, Express 5 (ESM), SSE |
| Views | Eta templates, server-rendered |
| Reactivity | [Datastar](https://data-star.dev) v1.0.4 (CDN) — signals + `@post()` → SSE patches |
| Data | Turso / libSQL (`@libsql/client`), local SQLite file in dev |
| Front end | Modern CSS (layers, nesting, `light-dark()`, container queries), vanilla web components |
| PWA | Web manifest, service worker (app shell + offline page), installable |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000, auto-restarts on change
```

On first boot the server creates the schema and seeds the rate tables, category fee presets and default settings into `local.db`.

Then open **Settings**, enter your origin ZIP and tap **Find furthest zone**. This reads the official USPS zone chart and keeps the worst zone that isn't AK, HI, a territory or military.

### Using Turso

```bash
cp .env.example .env   # set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
npm run seed           # create schema + seed data in Turso (resets rates & categories)
npm start
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with `node --watch`, loading `.env` if it exists |
| `npm start` | Start for production |
| `npm run seed` | Recreate rate tables and category presets (`--force`); settings are kept |
| `npm test` | Unit tests for the pricing math and zone parsing (`node:test`) |
| `npm run icons` | Regenerate the PNG app icons from code (no dependencies) |

### Claude Code commands

- `/dev [port]`: install dependencies if needed, start the dev server and confirm it responds.
- `/ship [message]`: run tests, commit on a `ship/*` branch, open a PR and squash-merge it into `main`.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Calculator. Inputs are Datastar signals; each change posts to `/calc`, which streams back the results and the mobile price bar. |
| `/settings` | Origin ZIP → furthest USPS zone, worst UPS zone, UPS dim divisor, default tax % and category |
| `/rates` | Editable rate grids per service (weight × zone). Cells save on change; edited cells are marked. |
| `/categories` | Editable eBay fee presets: add, edit, delete |

## Keeping the numbers honest

The calculator is only as accurate as its tables, so check these from time to time:

- **eBay label cost** is the main way to price shipping: paste eBay's Ground Advantage quote into the calculator (or use the Chrome extension in `extension/`). The rate tables below are only a fallback estimate when that field is empty. With **Qualifies for Media Mail** ticked, eBay's Media Mail quote goes in **eBay Media Mail cost** the same way.
- **USPS Ground Advantage** is seeded with *Commercial* prices from USPS Notice 123 (effective Oct 4, 2026). The app checks [USPS's price files](https://pe.usps.com/pricechange/index) once a day (the server looks hourly and fetches when the last check is over 24 hours old). When the price change in effect publishes a table that differs from yours, open `/rates` (no longer in the nav) and **Apply update** pulls it in. Cells you've edited are kept unless you tick the box to replace them. eBay Labels pricing can be lower: set **eBay Labels discount on USPS** in Settings, or edit `/rates` cells to match what you actually pay (edited cells ignore the discount).
- **UPS Ground** rates are **placeholders** (copied from USPS) until you enter your eBay UPS label prices. The calculator flags them with a "Placeholder rate" badge.
- **UPS worst zone** is a manual setting (default 8). Check UPS's zone chart for your ZIP.
- **eBay fees** change periodically. Compare `/categories` against [eBay's selling fees page](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822). Store subscribers usually pay less.

See [docs/pricing-math.md](docs/pricing-math.md) for the formulas.

## Project layout

```
server.js                 Express app entry
src/lib/fees.js           Pure pricing math (unit tested)
src/lib/zones.js          USPS zone-chart lookup (cached), lower-48 filter, destination zone
src/lib/states.js         ZIP prefix → state + state base sales-tax rate
src/lib/usps-prices.js    USPS price-file discovery, zip + CSV parsing (unit tested)
src/lib/rate-updates.js   Daily check for newer USPS rates, apply/dismiss
src/lib/quote.js          Glue: DB rates/settings → fee math
src/lib/sse.js            Minimal Datastar SSE helper
src/lib/views.js          Eta instance + formatting helpers
src/db/                   libSQL client, schema, seed, USPS rate data
src/routes/               calc, settings, rates, categories
views/                    Eta pages + partials (partials are SSE patch targets)
public/                   CSS, web components, manifest, service worker, icons
test/                     node:test suites
docs/                     Design notes
```
