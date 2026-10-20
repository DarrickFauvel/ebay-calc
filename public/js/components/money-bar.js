// <money-bar segments='[{"label":"Cost","value":5,"tone":"cost"}, …]' label="…" pad='{"label":"Pad $10","start":5,"value":10}'>
// Stacked bar showing how a list price splits up. The optional pad draws a bracket
// under the bar from `start` (in dollars) spanning `value`. Uses a container query so
// the legend sits beside the bar when there's room and below it when narrow.
const usd = (n) => (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2)

const css = `
  :host { display: block; container-type: inline-size; }
  .wrap { display: grid; gap: 0.6rem; }
  .bar {
    display: flex; block-size: 1.1rem; border-radius: 2px; overflow: hidden;
    background: var(--surface-2, #eee);
  }
  .bracket { position: relative; block-size: 1.6rem; margin-block-start: -0.35rem; }
  .bracket[hidden] { display: none; }
  .bracket span {
    position: absolute; inset-block-start: 0; block-size: 0.45rem;
    border: 2px solid var(--tone-ship, #088); border-block-start: 0; border-radius: 0 0 3px 3px;
  }
  .bracket b {
    position: absolute; inset-block-start: 0.45rem; inset-inline-start: 50%; translate: -50% 0;
    font-size: 0.8rem; white-space: nowrap; color: var(--tone-ship, #088);
  }
  .seg { min-inline-size: 2px; transition: flex-grow 0.25s ease; }
  ul { display: grid; gap: 0.3rem 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; font-size: 0.85rem; }
  li {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    column-gap: 0.4rem; grid-template-areas: "dot lbl pct" ". val val";
  }
  .dot { grid-area: dot; inline-size: 0.7rem; block-size: 0.7rem; border-radius: 3px; flex: none; }
  .lbl { grid-area: lbl; }
  .val { grid-area: val; font: 600 1.05rem / 1.2 var(--figures, inherit); font-variant-numeric: tabular-nums; }
  .pct { grid-area: pct; color: var(--muted, #666); font-size: 0.75rem; }
  @container (min-width: 30rem) {
    ul { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
`

class MoneyBar extends HTMLElement {
  static observedAttributes = ['segments', 'label', 'pad']

  constructor () {
    super()
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>${css}</style><div class="wrap"><div><div class="bar" role="img"></div><div class="bracket" aria-hidden="true" hidden><span><b></b></span></div></div><ul></ul></div>`
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
    let pad = null
    try { pad = JSON.parse(this.getAttribute('pad') || 'null') } catch {}
    const bracket = this.shadowRoot.querySelector('.bracket')
    bracket.hidden = !(pad?.value > 0)
    if (!bracket.hidden) {
      const start = Math.min(Math.max(0, pad.start) / total, 1)
      const span = bracket.querySelector('span')
      span.style.insetInlineStart = `${start * 100}%`
      span.style.inlineSize = `${Math.min(pad.value / total, 1 - start) * 100}%`
      bracket.querySelector('b').textContent = pad.label
    }

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
