export interface ItemDto {
  id: string
  name: string
  price: number
  quantity: number
  uploadedByParticipantId: string | null
}

export interface SessionDto {
  id: string
  currency: string
  status: string
  items: ItemDto[]
  myParticipantId: string
  myClaimedItemIds: string[]
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
