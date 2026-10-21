# Ship Pad Chrome extension

Copies weight, box size, ship-to ZIP and the **USPS Ground Advantage** price from
eBay's shipping calculator into Ship Pad's calculator.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Pin it from the puzzle-piece menu.

## Use

1. On [eBay's shipping calculator](https://www.ebay.com/shp/calc/rates), fill in the package and click **Calculate**.
2. Click the extension icon. It copies straight away (**Copy from eBay** redoes it).
3. Switch to Ship Pad's calculator (https://ship-pad.darrickdevelops.com or localhost:3000) and click **Fill from eBay** on the page, or click the extension icon. The icon copies on eBay and fills on Ship Pad by itself.

The icon only reads the tab you click it on (`activeTab`). The page button needs access to Ship Pad's two addresses, which Chrome lists as the extension's site access.
