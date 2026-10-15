// Minimal Datastar v1 SSE helper for Express.

export function sse (res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  const send = (event, lines) => {
    res.write(`event: ${event}\n${lines.map((l) => `data: ${l}\n`).join('')}\n`)
  }

  return {
    /** Patch HTML into the page. Default mode "outer" morphs by element id. */
    patchElements (html, { selector, mode } = {}) {
      const lines = []
      if (selector) lines.push(`selector ${selector}`)
      if (mode) lines.push(`mode ${mode}`)
      if (html.trim()) for (const line of html.trim().split('\n')) lines.push(`elements ${line}`)
      send('datastar-patch-elements', lines)
    },
    patchSignals (signals) {
      send('datastar-patch-signals', [`signals ${JSON.stringify(signals)}`])
    },
    end () {
      res.end()
    }
  }
}
