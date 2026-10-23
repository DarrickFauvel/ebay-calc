# Ship Pad Chrome extension

Copies weight, box size, ship-to ZIP and the **USPS Ground Advantage** price from
eBay's shipping calculator into Ship Pad's calculator.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Pin it from the puzzle-piece menu.
4. Click its **Details** and turn on **Allow User Scripts** (on Chrome before 138, Developer mode covers this).

## Updates

The scripts that run on eBay's pages (`ebay.js`, `ebay-content.js`, `ebay-listing.js`, `ebay-search.js`) load from Ship Pad's `/extension/` path, from the same Ship Pad the side panel shows (dev or live). Each eBay page load checks for a newer copy, and the next load uses it, so a change there needs no extension reload. Without **Allow User Scripts** (or when Ship Pad can't be reached the first time), the copies bundled in the extension run instead, and the side panel shows a note.

Changes to anything else (`manifest.json`, `background.js`, the side panel, popup or Ship Pad-side `content.js`) still need an update: unzip the new download over the same folder and click ↻ on the extension's card. There's no need to remove it.

## Use

1. Open [eBay's shipping calculator](https://www.ebay.com/shp/calc/rates).
2. Click **Open Ship Pad** (bottom-right of eBay's page) or the Ship Pad icon. Ship Pad slides open in Chrome's side panel, next to eBay. It stays open when you switch tabs (e.g. to the listing you're revising), so pages don't jump. A sticky bar at the top shows the price and package, and values flash when they change. It opens your dev Ship Pad (the last localhost or Codespaces address you opened in a normal tab) or the live site; the bar at the bottom shows which, the extension version (with an **Update** link when that Ship Pad has a newer one), and switches between them.
3. Fill in the package on eBay. The side panel's **From eBay** box updates as you type.
4. Click **Calculate** on eBay. The box picks up the USPS Ground Advantage price.
5. The side panel fills weight, box, ship-to ZIP and the eBay label cost as soon as the price appears.

On eBay's listing editor (`ebay.com/lstng`, including **Revise item**), a Ship Pad bar with a blue-striped edge sits just above eBay's own footer (on phones, swipe it sideways). Its buttons jump to the custom label (**Cost**, read from the SKU), **Price** and **Shipping** fields and the **Revise it** button. They show the cost, item price and selected shipping policy as you edit. The **→** beside Cost and Price sends that value to Ship Pad (the side panel and any open Ship Pad tab): cost fills Item cost, and price switches to **Check a price** and fills List price. The **Package** button shows the listing's weight and box; its **→** fills them, with the ship-from ZIP from Ship Pad's Settings, into eBay's shipping calculator (an open calculator tab, or a new one).

On eBay search results (`ebay.com/sch/`), a Ship Pad bar sits at the bottom of the page. Pick **New**, **Used** or **Parts** (or none for any condition) and tap **Sold** to reload the search with Buy It Now, Sold and Completed turned on, or **Active** for the same search with just Buy It Now (what's for sale now). Tap the highlighted one again to turn them off. On sold results, the bar shows the median sold price, the median total (price + shipping), the median total and count for free-shipping and paid-shipping sales separately, and the sell-through rate (STR): sold ÷ (sold + active), where active is the same search without Sold and Completed. Hover it for the raw counts. Its **→** switches Ship Pad to **Check a price** and fills List price with the median total. Cards with a price range, a best offer accepted (the real price is hidden) or no shipping shown are left out.

On any other tab the icon opens the popup: on a Ship Pad tab it fills in what was captured from eBay.

The extension runs only on eBay's calculator (`ebay.com/shp/calc/`), eBay's listing editor (`ebay.com/lstng`), eBay search results (`ebay.com/sch/`), Ship Pad's addresses (including Codespaces `*.app.github.dev`), and on any tab when you click its icon.
