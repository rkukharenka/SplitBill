import { renderSession } from './screens/session'
import { renderResults } from './screens/results'

function getSessionId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('session')
}

async function main() {
  window.Telegram?.WebApp?.ready()
  window.Telegram?.WebApp?.expand()

  const app = document.getElementById('app')!
  const sessionId = getSessionId()

  if (!sessionId) {
    app.innerHTML = '<p style="padding:16px;color:red">Нет ID сессии. Открой приложение через бота.</p>'
    return
  }

  await renderSession(app, sessionId, () => {
    renderResults(app, sessionId, () => {
      renderSession(app, sessionId, () => {
        renderResults(app, sessionId, () => {})
      })
    })
  })
}

main().catch(err => {
  document.getElementById('app')!.innerHTML =
    `<p style="padding:16px;color:red">Ошибка: ${err.message}</p>`
})
