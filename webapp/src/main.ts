import { renderSession } from './screens/session'
import { renderResults } from './screens/results'

function getSessionId(): string | null {
  const params = new URLSearchParams(window.location.search)
  // ?session= is used by the private-chat web_app button; start_param by the
  // group/channel startapp deep link (https://t.me/<bot>?startapp=<sessionId>)
  return params.get('session') ?? window.Telegram?.WebApp?.initDataUnsafe?.start_param ?? null
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

  // mutually recursive navigation — supports unlimited back-and-forth between screens
  function showSession() { renderSession(app, sessionId!, showResults) }
  function showResults() { renderResults(app, sessionId!, showSession) }
  showSession()
}

main().catch(err => {
  document.getElementById('app')!.innerHTML =
    `<p style="padding:16px;color:red">Ошибка: ${err.message}</p>`
})
