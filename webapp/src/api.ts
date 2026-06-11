import type { SessionDto, ItemDto, ResultsDto } from './types'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        ready(): void
        expand(): void
      }
    }
  }
}

const BASE = '/api/webapp/sessions'

function initData(): string {
  return window.Telegram?.WebApp?.initData ?? ''
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initData(),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function getSession(sessionId: string): Promise<SessionDto> {
  const res = await fetch(`${BASE}/${sessionId}`, { headers: headers() })
  return handleResponse<SessionDto>(res)
}

export async function addItem(sessionId: string, name: string, price: number, quantity: number): Promise<ItemDto> {
  const res = await fetch(`${BASE}/${sessionId}/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, price, quantity }),
  })
  return handleResponse<ItemDto>(res)
}

export async function uploadPhoto(sessionId: string, file: File): Promise<ItemDto[]> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/${sessionId}/photo`, {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': initData() },
    body: form,
  })
  return handleResponse<ItemDto[]>(res)
}

export async function updateClaims(sessionId: string, itemIds: string[]): Promise<string[]> {
  const res = await fetch(`${BASE}/${sessionId}/claims`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ itemIds }),
  })
  return handleResponse<string[]>(res)
}

export async function getResults(sessionId: string): Promise<ResultsDto> {
  const res = await fetch(`${BASE}/${sessionId}/results`, { headers: headers() })
  return handleResponse<ResultsDto>(res)
}
