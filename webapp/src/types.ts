export interface ParticipantDto {
  id: string
  displayName: string
  isGuest: boolean
}

export interface ItemDto {
  id: string
  name: string
  price: number
  quantity: number
  payerId: string | null
  sharerIds: string[]
}

export interface SessionDto {
  id: string
  currency: string
  status: string
  participants: ParticipantDto[]
  items: ItemDto[]
  myParticipantId: string
}

export interface ParticipantSummaryDto {
  id: string
  displayName: string
  totalAmount: number
}

export interface TransferDto {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

export interface ResultsDto {
  participants: ParticipantSummaryDto[]
  transfers: TransferDto[]
}
