export interface ItemModalOptions {
  title?: string
  submitLabel?: string
  name?: string
  price?: number
  quantity?: number
}

export function createAddItemModal(
  onSubmit: (name: string, price: number, quantity: number) => void,
  opts: ItemModalOptions = {},
): HTMLElement {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;z-index:100'

  const sheet = document.createElement('div')
  sheet.style.cssText = 'background:var(--tg-theme-bg-color,#fff);width:100%;padding:20px;border-radius:16px 16px 0 0'

  sheet.innerHTML = `
    <h3 style="margin-bottom:16px">${opts.title ?? 'Добавить позицию'}</h3>
    <input id="item-name" type="text" placeholder="Название" value="${opts.name ?? ''}" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-price" type="number" step="0.01" min="0.01" placeholder="Цена" value="${opts.price ?? ''}" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-qty" type="number" min="1" value="${opts.quantity ?? 1}" placeholder="Количество" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <div style="display:flex;gap:8px">
      <button id="modal-cancel" style="flex:1;padding:12px;border:none;border-radius:8px;background:#eee;font-size:16px">Отмена</button>
      <button id="modal-submit" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:16px">${opts.submitLabel ?? 'Добавить'}</button>
    </div>
  `

  overlay.appendChild(sheet)

  overlay.querySelector('#modal-cancel')!.addEventListener('click', () => overlay.remove())
  overlay.querySelector('#modal-submit')!.addEventListener('click', () => {
    const name = (overlay.querySelector('#item-name') as HTMLInputElement).value.trim()
    const price = parseFloat((overlay.querySelector('#item-price') as HTMLInputElement).value)
    const quantity = parseInt((overlay.querySelector('#item-qty') as HTMLInputElement).value)
    if (!name || isNaN(price) || price <= 0 || isNaN(quantity) || quantity < 1) {
      alert('Заполните все поля корректно')
      return
    }
    overlay.remove()
    onSubmit(name, price, quantity)
  })

  return overlay
}
