package com.splitbill.webapp.dto

import java.math.BigDecimal
import java.util.UUID

data class SessionDto(
    val id: UUID,
    val currency: String,
    val status: String,
    val items: List<ItemDto>,
    val myParticipantId: UUID,
    val myClaimedItemIds: List<UUID>
)

data class ItemDto(
    val id: UUID,
    val name: String,
    val price: BigDecimal,
    val quantity: Int,
    val uploadedByParticipantId: UUID?
)

data class AddItemRequest(
    val name: String,
    val price: BigDecimal,
    val quantity: Int = 1
)

data class UpdateClaimsRequest(
    val itemIds: List<UUID>
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
