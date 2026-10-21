# Ship Pad Chrome extension

Copies weight, box size, ship-to ZIP and the **USPS Ground Advantage** price from
eBay's shipping calculator into Ship Pad's calculator.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Pin it from the puzzle-piece menu.

## Use

1. Open eBay's shipping calculator (Ship Pad's **Open eBay calculator** button opens it in a new tab).
2. Click **Open Ship Pad** (bottom-right of eBay's page) or the Ship Pad icon. Ship Pad slides open in Chrome's side panel, next to eBay. It opens the Ship Pad address you used last (the live site, localhost:3000 or a Codespaces address), so open Ship Pad in a normal tab once first.
3. Fill in the package on eBay. The side panel's **From eBay** box updates as you type.
4. Click **Calculate** on eBay. The box picks up the USPS Ground Advantage price.
5. Click into the side panel. It fills weight, box, ship-to ZIP and the eBay label cost automatically. **Fill now** does the same by hand.

On any other tab the icon opens the popup: on a Ship Pad tab it fills in what was captured from eBay.

The extension runs only on eBay's calculator (`ebay.com/shp/calc/`), Ship Pad's addresses (including Codespaces `*.app.github.dev`), and on any tab when you click its icon.
