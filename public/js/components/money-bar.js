// <money-bar segments='[{"label":"Cost","value":5,"tone":"cost"}, …]' label="…">
// Stacked bar showing how a list price splits up. Uses a container query so
// the legend sits beside the bar when there's room and below it when narrow.
const usd = (n) => (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2)

const css = `
  :host { display: block; container-type: inline-size; }
  .wrap { display: grid; gap: 0.6rem; }
  .bar {
    display: flex; block-size: 0.9rem; border-radius: 999px; overflow: hidden;
    background: var(--surface-2, #eee);
  }
  .seg { min-inline-size: 2px; transition: flex-grow 0.25s ease; }
  ul { display: grid; gap: 0.3rem 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; font-size: 0.85rem; }
  li {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    column-gap: 0.4rem; grid-template-areas: "dot lbl pct" ". val val";
  }
  .dot { grid-area: dot; inline-size: 0.7rem; block-size: 0.7rem; border-radius: 3px; flex: none; }
  .lbl { grid-area: lbl; }
  .val { grid-area: val; font-variant-numeric: tabular-nums; font-weight: 600; }
  .pct { grid-area: pct; color: var(--muted, #666); font-size: 0.75rem; }
  @container (min-width: 30rem) {
    ul { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
`

class MoneyBar extends HTMLElement {
  static observedAttributes = ['segments', 'label']

  constructor () {
    super()
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>${css}</style><div class="wrap"><div class="bar" role="img"></div><ul></ul></div>`
  }

  connectedCallback () { this.render() }
  attributeChangedCallback () { this.render() }

  render () {
    let segments
    try { segments = JSON.parse(this.getAttribute('segments') || '[]') } catch { return }
    const bar = this.shadowRoot.querySelector('.bar')
    const list = this.shadowRoot.querySelector('ul')
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1
    const color = (tone) => `var(--tone-${tone}, #888)`

    bar.setAttribute('aria-label', `${this.getAttribute('label') ?? ''}: ${segments.map((s) => `${s.label} ${usd(s.value)}`).join(', ')}`)
    bar.replaceChildren(...segments.filter((s) => s.value > 0).map((s) => {
      const el = document.createElement('span')
      el.className = 'seg'
      el.style.flexGrow = s.value
      el.style.background = color(s.tone)
      el.title = `${s.label}: ${usd(s.value)}`
      return el
    }))
    list.replaceChildren(...segments.map((s) => {
      const li = document.createElement('li')
      li.innerHTML = '<span class="dot"></span><span class="lbl"></span><span class="pct"></span><span class="val"></span>'
      li.querySelector('.dot').style.background = color(s.tone)
      li.querySelector('.lbl').textContent = s.label
      li.querySelector('.pct').textContent = s.value > 0 ? `${Math.round((s.value / total) * 100)}%` : ''
      li.querySelector('.val').textContent = usd(s.value)
      return li
    }))
  }
}

customElements.define('money-bar', MoneyBar)
