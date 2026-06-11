import type { SessionDto, ItemDto } from '../types'
import { getSession, addItem, uploadPhoto, updateClaims } from '../api'
import { createAddItemModal } from '../components/addItemModal'

export async function renderSession(container: HTMLElement, sessionId: string, onResults: () => void) {
  container.innerHTML = '<p style="padding:16px">Загрузка...</p>'

  let session: SessionDto
  try {
    session = await getSession(sessionId)
  } catch (e) {
    container.innerHTML = `<p style="padding:16px;color:red">Ошибка загрузки сессии: ${(e as Error).message}</p>`
    return
  }

  const claimedIds = new Set<string>(session.myClaimedItemIds)

  function formatPrice(item: ItemDto): string {
    const total = item.price * item.quantity
    return item.quantity > 1
      ? `${item.quantity} × ${item.price} = ${total} ${session.currency}`
      : `${item.price} ${session.currency}`
  }

  function myTotal(): number {
    return session.items
      .filter(i => claimedIds.has(i.id))
      .reduce((sum, i) => sum + i.price * i.quantity, 0)
  }

  function render() {
    container.innerHTML = `
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:16px">${session.currency} · ${session.status}</p>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <label style="flex:1">
            <button id="btn-photo" style="width:100%;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">📷 Загрузить чек</button>
            <input id="photo-input" type="file" accept="image/*" style="display:none" />
          </label>
          <button id="btn-add" style="flex:1;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">+ Позиция</button>
        </div>
        <div id="items-list"></div>
        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--tg-theme-bg-color,#fff);border-top:1px solid #eee;max-width:480px;margin:0 auto">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>Мои позиции: <b>${myTotal().toFixed(2)} ${session.currency}</b></span>
            <button id="btn-results" style="padding:10px 16px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:14px">Итоги →</button>
          </div>
        </div>
      </div>
    `

    const list = container.querySelector('#items-list')!
    session.items.forEach(item => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0'
      const checked = claimedIds.has(item.id)
      row.innerHTML = `
        <input type="checkbox" id="item-${item.id}" ${checked ? 'checked' : ''} style="width:20px;height:20px;margin-right:12px;flex-shrink:0" />
        <label for="item-${item.id}" style="flex:1;cursor:pointer">
          <div style="font-size:15px">${item.name}</div>
          <div style="font-size:13px;color:#888">${formatPrice(item)}</div>
        </label>
      `
      const checkbox = row.querySelector('input')!
      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) claimedIds.add(item.id)
        else claimedIds.delete(item.id)
        container.querySelector<HTMLElement>('b')!.textContent = `${myTotal().toFixed(2)} ${session.currency}`
        try {
          await updateClaims(sessionId, Array.from(claimedIds))
        } catch (e) {
          checkbox.checked = !checkbox.checked
          if (checkbox.checked) { claimedIds.add(item.id) } else { claimedIds.delete(item.id) }
        }
      })
      list.appendChild(row)
    })

    container.querySelector('#btn-photo')!.addEventListener('click', () => {
      container.querySelector<HTMLInputElement>('#photo-input')!.click()
    })

    container.querySelector('#photo-input')!.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const btn = container.querySelector<HTMLButtonElement>('#btn-photo')!
      btn.textContent = '⏳ Распознаю...'
      btn.disabled = true
      try {
        const newItems = await uploadPhoto(sessionId, file)
        session.items.push(...newItems)
        render()
      } catch (err) {
        alert(`Ошибка: ${(err as Error).message}`)
        btn.textContent = '📷 Загрузить чек'
        btn.disabled = false
      }
    })

    container.querySelector('#btn-add')!.addEventListener('click', () => {
      const modal = createAddItemModal(async (name, price, quantity) => {
        try {
          const newItem = await addItem(sessionId, name, price, quantity)
          session.items.push(newItem)
          render()
        } catch (err) {
          alert(`Ошибка: ${(err as Error).message}`)
        }
      })
      document.body.appendChild(modal)
    })

    container.querySelector('#btn-results')!.addEventListener('click', onResults)
  }

  render()
}
