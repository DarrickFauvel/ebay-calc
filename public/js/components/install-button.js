// <install-button> — shows an "Install app" button when the browser offers PWA install.
let deferred = null
const instances = new Set()

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
  instances.forEach((el) => el.update())
})
addEventListener('appinstalled', () => {
  deferred = null
  instances.forEach((el) => el.update())
})

class InstallButton extends HTMLElement {
  connectedCallback () {
    instances.add(this)
    if (!this.button) {
      this.button = document.createElement('button')
      this.button.type = 'button'
      this.button.className = 'secondary'
      this.button.textContent = 'Install app'
      this.button.addEventListener('click', async () => {
        if (!deferred) return
        deferred.prompt()
        await deferred.userChoice
        deferred = null
        this.update()
      })
      this.append(this.button)
    }
    this.update()
  }

  disconnectedCallback () { instances.delete(this) }

  update () { this.hidden = !deferred }
}

customElements.define('install-button', InstallButton)
