package com.splitbill.webapp.dto

import java.math.BigDecimal
import java.util.UUID

data class SessionDto(
    val id: UUID,
    val currency: String,
    val status: String,
    val participants: List<ParticipantDto>,
    val items: List<ItemDto>,
    val myParticipantId: UUID
)

data class ParticipantDto(
    val id: UUID,
    val displayName: String,
    val isGuest: Boolean
)

data class ItemDto(
    val id: UUID,
    val name: String,
    val price: BigDecimal,
    val quantity: Int,
    val payerId: UUID?,
    val sharerIds: List<UUID>
)

data class AddItemRequest(
    val name: String,
    val price: BigDecimal,
    val quantity: Int = 1
)

data class AddParticipantRequest(
    val name: String
)

data class ItemAssignmentRequest(
    val payerId: UUID,
    val sharerIds: List<UUID>
)

data class ResultsDto(
    val participants: List<ParticipantSummaryDto>,
    val transfers: List<TransferDto>
)

data class ParticipantSummaryDto(
    val id: UUID,
    val displayName: String,
    val totalAmount: BigDecimal
)

data class TransferDto(
    val fromId: UUID,
    val fromName: String,
    val toId: UUID,
    val toName: String,
    val amount: BigDecimal
)
