// <qr-button> — header button that shows a QR code of the current page, to open it on a phone.
class QrButton extends HTMLElement {
  connectedCallback () {
    if (this.button) return
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'secondary icon-label'
    this.button.setAttribute('aria-haspopup', 'dialog')
    this.button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3Zm2 2v3h3V5Zm9-2h7v7h-7Zm2 2v3h3V5ZM3 14h7v7H3Zm2 2v3h3v-3Zm9-2h3v3h-3Zm4 0h3v3h-3v-3Zm-4 4h3v3h-3Zm4 0h3v3h-3Z"/></svg><span>QR</span>'
    this.button.addEventListener('click', () => this.open())
    this.append(this.button)
  }

  open () {
    // Drop the trailing slash ("https://host/" → "https://host", "/rates/" → "/rates") for a shorter code.
    const url = location.origin + location.pathname.replace(/\/+$/, '') + location.search + location.hash
    this.dialog ??= this.buildDialog()
    this.dialog.querySelector('img').src = `/qr.svg?u=${encodeURIComponent(url)}`
    this.dialog.querySelector('.qr-url').textContent = url
    // A phone can't reach this machine's localhost; say so instead of failing silently.
    this.dialog.querySelector('.qr-local').hidden = !/^(localhost|127\.|\[::1\])/.test(location.hostname)
    this.dialog.showModal()
  }

  buildDialog () {
    const dialog = document.createElement('dialog')
    dialog.className = 'qr-dialog'
    dialog.setAttribute('aria-labelledby', 'qr-title')
    dialog.innerHTML = `
      <h2 id="qr-title">Open on your phone</h2>
      <img alt="QR code for this page" width="240" height="240">
      <p class="qr-url hint"></p>
      <p class="qr-local status warn" hidden>This is a localhost address, so a phone can't open it. Use the forwarded or deployed URL instead.</p>
      <form method="dialog"><button>Close</button></form>`
    // Click on the backdrop closes it.
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
    this.append(dialog)
    return dialog
  }
}

customElements.define('qr-button', QrButton)
