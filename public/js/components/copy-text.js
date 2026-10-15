// <copy-text value="12.99">$12.99</copy-text> — tap to copy a price for pasting into eBay.
class CopyText extends HTMLElement {
  connectedCallback () {
    if (this.shadowRoot) return
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        button { all: unset; cursor: pointer; border-radius: 0.3em; position: relative; }
        button:focus-visible { outline: 2px solid var(--accent, blue); outline-offset: 2px; }
        button:hover { text-decoration: underline dotted; text-underline-offset: 0.15em; }
        .tip {
          position: absolute; inset-block-end: 100%; inset-inline-start: 50%; translate: -50% -0.3rem;
          font-size: 0.75rem; font-weight: 600; letter-spacing: 0; white-space: nowrap;
          padding: 0.15rem 0.45rem; border-radius: 0.3rem;
          background: var(--text, #000); color: var(--surface, #fff);
          opacity: 0; transition: opacity 0.15s; pointer-events: none;
        }
        .tip.show { opacity: 1; }
      </style>
      <button type="button" part="button"><slot></slot><span class="tip" aria-live="polite"></span></button>`
    const button = this.shadowRoot.querySelector('button')
    const tip = this.shadowRoot.querySelector('.tip')
    button.title = 'Copy'
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.getAttribute('value') ?? this.textContent.trim())
        tip.textContent = 'Copied'
      } catch {
        tip.textContent = 'Copy failed'
      }
      tip.classList.add('show')
      setTimeout(() => tip.classList.remove('show'), 1200)
    })
  }
}

customElements.define('copy-text', CopyText)
