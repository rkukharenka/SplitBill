import type { SessionDto, ItemDto } from '../types'
import { getSession, addItem, uploadPhoto, setItemAssignment, addParticipant } from '../api'
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

  function formatPrice(item: ItemDto): string {
    const total = item.price * item.quantity
    return item.quantity > 1
      ? `${item.quantity} × ${item.price} = ${total} ${session.currency}`
      : `${item.price} ${session.currency}`
  }

  function rosterOptions(selectedId: string | null): string {
    return session.participants
      .map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.displayName}</option>`)
      .join('')
  }

  async function persist(item: ItemDto) {
    try {
      const saved = await setItemAssignment(sessionId, item.id, item.payerId ?? session.myParticipantId, item.sharerIds)
      item.payerId = saved.payerId
      item.sharerIds = saved.sharerIds
    } catch (e) {
      alert(`Не удалось сохранить: ${(e as Error).message}`)
      render()
    }
  }

  function render() {
    container.innerHTML = `
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:12px">${session.currency} · ${session.status}</p>
        <div id="roster" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <label style="flex:1">
            <button id="btn-photo" style="width:100%;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">📷 Загрузить чек</button>
            <input id="photo-input" type="file" accept="image/*" style="display:none" />
          </label>
          <button id="btn-add" style="flex:1;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">+ Позиция</button>
        </div>
        <div id="items-list"></div>
        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--tg-theme-bg-color,#fff);border-top:1px solid #eee;max-width:480px;margin:0 auto">
          <button id="btn-results" style="width:100%;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:15px">Итоги →</button>
        </div>
      </div>
    `

    const roster = container.querySelector('#roster')!
    session.participants.forEach(p => {
      const chip = document.createElement('span')
      chip.style.cssText = 'padding:4px 10px;border-radius:14px;background:#f0f0f0;font-size:13px'
      chip.textContent = p.isGuest ? `👤 ${p.displayName}` : p.displayName
      roster.appendChild(chip)
    })
    const addGuestBtn = document.createElement('button')
    addGuestBtn.textContent = '+ Гость'
    addGuestBtn.style.cssText = 'padding:4px 10px;border-radius:14px;border:1px dashed #ccc;background:transparent;font-size:13px'
    addGuestBtn.addEventListener('click', async () => {
      const name = prompt('Имя гостя')?.trim()
      if (!name) return
      try {
        const guest = await addParticipant(sessionId, name)
        session.participants.push(guest)
        render()
      } catch (e) {
        alert(`Ошибка: ${(e as Error).message}`)
      }
    })
    roster.appendChild(addGuestBtn)

    const list = container.querySelector('#items-list')!
    session.items.forEach(item => {
      const row = document.createElement('div')
      row.style.cssText = 'padding:12px 0;border-bottom:1px solid #f0f0f0'
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:15px">${item.name}</span>
          <span style="font-size:13px;color:#888">${formatPrice(item)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:12px;color:#888">Платил:</span>
          <select class="payer-select" style="flex:1;padding:4px;border:1px solid #ddd;border-radius:6px;font-size:13px">
            ${rosterOptions(item.payerId)}
          </select>
        </div>
        <div class="sharers" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      `

      const payerSelect = row.querySelector<HTMLSelectElement>('.payer-select')!
      payerSelect.addEventListener('change', () => {
        item.payerId = payerSelect.value
        persist(item)
      })

      const sharers = row.querySelector('.sharers')!
      session.participants.forEach(p => {
        const label = document.createElement('label')
        label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:13px'
        const checked = item.sharerIds.includes(p.id)
        label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} style="width:16px;height:16px" /> ${p.displayName}`
        const cb = label.querySelector('input')!
        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (!item.sharerIds.includes(p.id)) item.sharerIds.push(p.id)
          } else {
            item.sharerIds = item.sharerIds.filter(idv => idv !== p.id)
          }
          persist(item)
        })
        sharers.appendChild(label)
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
