# Pricing math

All of this lives in `src/lib/fees.js` as pure functions and is covered by `test/fees.test.js`.

## Assumptions

- The listing offers **free shipping**, so the buyer pays `price + sales tax` and nothing for shipping.
- You buy the label yourself. The cost is the rate for the **billable weight** at your **worst lower-48 zone**.
- eBay's **final value fee (FVF)** is charged on the buyer's total **including sales tax**.
- The **per-order fee** is $0.30 when the order total is ≤ $10, otherwise $0.40. Some presets waive it (e.g. athletic shoes $150+).

## Shipping

```
billable_oz = max(actual_oz, dim_oz)
dim_oz      = ceil(L × W × H / divisor) lb × 16     (L, W, H rounded up to whole inches)
```

| Service | Dim weight applies | Divisor | Minimum |
| --- | --- | --- | --- |
| USPS Ground Advantage | only above 1 ft³ (1,728 in³) | 166 | — |
| UPS Ground | always (when dimensions are entered) | setting, default 139 | 1 lb |

The rate is the first row in the table whose `max_oz ≥ billable_oz`, at the worst zone for that service. The cheapest service is used for pricing, and the others are shown for comparison. UPS without box dimensions is flagged "Needs box size" and isn't picked as cheapest, because its real price depends on dim weight.

### Worst zone

`src/lib/zones.js` calls the USPS zone chart (`postcalc.usps.com/DomesticZoneChart/GetZoneChart`) for the origin ZIP3. It drops non-contiguous destinations (PR/VI 006–009, military 090–099/340/962–966, HI/Pacific 967–969, AK 995–999) and keeps the highest remaining zone. Some chart entries are 5-digit ZIPs (e.g. `96700`); those map to their ZIP3 before filtering.

## Fees and profit at a given price

```
sales_tax   = round(price × tax%, 2)   # charged to the cent, e.g. MA 6.25%
order_total = price + sales_tax
fvf         = tiered(order_total)              rate% up to threshold, tier% above
per_order   = 0.30 if order_total ≤ 10 else 0.40   (0 if waived)
payout      = price − fvf − per_order
profit      = payout − shipping − cost
```

## Solving for a target profit

Ignoring thresholds, the closed form is:

```
price = (cost + shipping + per_order + profit) / (1 − fvf% × (1 + tax%))
```

The per-order fee steps at $10 and the FVF tiers at the threshold, so `solvePrice` uses **bisection** instead. Profit rises steadily with price (fees are always under 100%), so bisection finds the **lowest cent price** that meets the target, even across those steps. A `.99` charm price is offered alongside.

## The shipping pad

```
ship_pad = solvePrice(shipping = label) − solvePrice(shipping = 0)
         ≈ label / (1 − fvf% × (1 + tax%))
```

Example: with a $10 label, 13.6% FVF and 7.5% tax, the pad is about **$11.71**, not $10. eBay takes its cut of the part of the price that covers shipping, and of the tax on it. This number is the main thing to take away when setting free-shipping prices.
