# Ship Pad Chrome extension

Copies weight, box size, ship-to ZIP and the **USPS Ground Advantage** price from
eBay's shipping calculator into Ship Pad's calculator.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Pin it from the puzzle-piece menu.

## Use

1. On eBay's shipping calculator, fill in the package and click **Calculate**.
2. Click the extension → **Copy from eBay**.
3. Switch to Ship Pad's calculator (https://ship-pad.darrickdevelops.com or localhost:3000) → **Fill Ship Pad**.

It only reads the tab you click it on (`activeTab`), so it needs no site permissions.
