import type { SessionDto, ItemDto, ParticipantDto, ResultsDto } from './types'

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

export async function setItemAssignment(
  sessionId: string,
  itemId: string,
  payerId: string,
  sharerIds: string[],
): Promise<ItemDto> {
  const res = await fetch(`${BASE}/${sessionId}/items/${itemId}/assignment`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ payerId, sharerIds }),
  })
  return handleResponse<ItemDto>(res)
}

export async function addParticipant(sessionId: string, name: string): Promise<ParticipantDto> {
  const res = await fetch(`${BASE}/${sessionId}/participants`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name }),
  })
  return handleResponse<ParticipantDto>(res)
}

export async function getResults(sessionId: string): Promise<ResultsDto> {
  const res = await fetch(`${BASE}/${sessionId}/results`, { headers: headers() })
  return handleResponse<ResultsDto>(res)
}
