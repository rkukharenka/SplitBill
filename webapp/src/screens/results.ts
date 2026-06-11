import type { ResultsDto } from '../types'
import { getResults } from '../api'

export async function renderResults(container: HTMLElement, sessionId: string, onBack: () => void) {
  container.innerHTML = '<p style="padding:16px">Считаю...</p>'

  let results: ResultsDto
  try {
    results = await getResults(sessionId)
  } catch (e) {
    container.innerHTML = `<p style="padding:16px;color:red">Ошибка: ${(e as Error).message}</p>`
    return
  }

  const rows = results.participants.map(p =>
    `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
       <span>${p.displayName}</span>
       <b>${p.totalAmount.toFixed(2)}</b>
     </div>`
  ).join('')

  const transfers = results.transfers.length
    ? results.transfers.map(t =>
        `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">
           ${t.fromName} → ${t.toName}: <b>${t.amount.toFixed(2)}</b>
         </div>`
      ).join('')
    : '<p style="color:#888;padding:8px 0">Все в расчёте 🎉</p>'

  container.innerHTML = `
    <div>
      <div style="display:flex;align-items:center;margin-bottom:16px">
        <button id="btn-back" style="border:none;background:none;font-size:22px;padding:0 8px 0 0;cursor:pointer">←</button>
        <h2>Итоги</h2>
      </div>
      <section style="margin-bottom:24px">
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Суммы участников</h3>
        ${rows}
      </section>
      <section>
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Переводы</h3>
        ${transfers}
      </section>
    </div>
  `

  container.querySelector('#btn-back')!.addEventListener('click', onBack)
}
