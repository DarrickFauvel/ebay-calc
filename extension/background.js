// The icon opens Ship Pad in the side panel on eBay's calculator, and the popup everywhere else.
const CALC = 'https://www.ebay.com/shp/calc/'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// tab.url is only visible for eBay's calculator (host_permissions), so other tabs read as "not eBay".
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  const onCalc = !!tab.url?.startsWith(CALC)
  chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: onCalc })
  chrome.action.setPopup({ tabId, popup: onCalc ? '' : 'popup.html' })
})
