# CLAUDE.md

Ship Pad: price, comp and list on eBay without losing money on shipping. A desktop web app plus a Chrome extension (it runs in Chrome's side panel next to eBay). See README.md for features and docs/pricing-math.md for the formulas.

## Commands

- `npm run dev`: dev server on :3000 (`node --watch`). The DB schema is created and seeded on first boot into `local.db`.
- `npm test`: `node:test` suites in `test/`.
- `npm run seed`: reset rates and categories (keeps settings).
- Slash commands: `/dev`, `/ship` (tests → branch → PR → squash-merge to `main`).

## Architecture

- Express 5 + Eta, server-rendered. Datastar v1.0.4 comes from the jsDelivr CDN. There is no build step and no bundler.
- Interactivity is Datastar: the form's `data-signals` and `data-bind` feed `@post('/calc')`, and the server replies over SSE (`src/lib/sse.js`) with `datastar-patch-elements` / `datastar-patch-signals`. Patch targets are Eta partials with stable ids (`#results`, `#peek`, `#settings-status`, `#rate-<id>`, `#cat-<id>`).
- Datastar v1 syntax: `data-on:input__debounce.250ms`, `data-bind="name"`, `data-attr:disabled`, `@post(url, {payload})`. Signals starting with `_` are local (never sent to the server).
- All pricing math is pure in `src/lib/fees.js`. Keep DB and I/O out of it and add tests for any change. `src/lib/quote.js` is the glue layer.
- DB access is `@libsql/client`. It uses Turso when `TURSO_DATABASE_URL` is set, otherwise `file:local.db`. The schema lives in `src/db/client.js` (`CREATE TABLE IF NOT EXISTS`).

## Conventions

- ESM, no semicolons, 2-space indent, space before function parens (standard style).
- CSS is mobile-first: base styles target phones, and wider layouts use `@media (min-width: 52rem)` or `@container`. Inputs stay at ≥16px font and tap targets at ≥2.75rem.
- Web components (`public/js/components/`) are small, dependency-free, and progressive. Server HTML must still make sense without them.
- When adding a static asset, also add it to `SHELL` in `public/sw.js` and bump `VERSION`.
- The USPS zone-chart endpoint needs a `shippingDate` param and a browser-like User-Agent.
