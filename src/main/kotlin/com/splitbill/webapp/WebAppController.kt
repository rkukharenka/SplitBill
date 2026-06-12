package com.splitbill.webapp

import com.splitbill.participant.Participant
import com.splitbill.participant.ParticipantRepository
import com.splitbill.receipt.ReceiptItemEntity
import com.splitbill.receipt.ReceiptItemRepository
import com.splitbill.receipt.ReceiptParserService
import com.splitbill.session.SplitSessionRepository
import com.splitbill.split.Claim
import com.splitbill.split.ClaimRepository
import com.splitbill.webapp.dto.*
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.codec.multipart.FilePart
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.server.ServerWebExchange
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID

@RestController
@RequestMapping("/api/webapp/sessions")
class WebAppController(
    private val sessionRepository: SplitSessionRepository,
    private val itemRepository: ReceiptItemRepository,
    private val participantRepository: ParticipantRepository,
    private val claimRepository: ClaimRepository,
    private val parserService: ReceiptParserService,
    private val debtCalculator: DebtCalculatorService
) {
    @GetMapping("/{id}")
    suspend fun getSession(@PathVariable id: UUID, exchange: ServerWebExchange): SessionDto {
        val userId = exchange.telegramUserId()
        val session = sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

        // auto-create caller's participant BEFORE listing the roster so they appear in it
        val me = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
            ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

        val participants = participantRepository.findBySessionId(id).collectList().awaitSingle()
        val items = itemRepository.findBySessionId(id).collectList().awaitSingle()
        val claims = claimRepository.findAllBySessionId(id).collectList().awaitSingle()
        val sharersByItem: Map<UUID, List<UUID>> =
            claims.groupBy({ it.itemId }, { it.participantId })

        return SessionDto(
            id = session.id,
            currency = session.currency,
            status = session.status,
            participants = participants.map { it.toDto() },
            items = items.map { it.toDto(sharersByItem[it.id] ?: emptyList()) },
            myParticipantId = me.id
        )
    }

    @PostMapping("/{id}/items")
    suspend fun addItem(
        @PathVariable id: UUID,
        @RequestBody request: AddItemRequest,
        exchange: ServerWebExchange
    ): ItemDto {
        val userId = exchange.telegramUserId()
        val session = sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

        val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
            ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

        val entity = ReceiptItemEntity(
            id = UUID.randomUUID(),
            sessionId = session.id,
            name = request.name,
            price = request.price,
            quantity = request.quantity,
            uploadedBy = participant.id
        )
        return itemRepository.save(entity).awaitSingle().toDto(emptyList())
    }

    @PostMapping("/{id}/photo", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    suspend fun uploadPhoto(
        @PathVariable id: UUID,
        @RequestPart("file") filePart: FilePart,
        exchange: ServerWebExchange
    ): List<ItemDto> {
        val userId = exchange.telegramUserId()
        val session = sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

        val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
            ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

        val bytes = filePart.content()
            .map { buf ->
                val bytes = ByteArray(buf.readableByteCount())
                buf.read(bytes)
                bytes
            }
            .reduce { a, b -> a + b }
            .awaitSingle()

        val contentType = filePart.headers().contentType?.toString() ?: "image/jpeg"
        val result = parserService.parse(bytes, contentType)

        if (result.items.isEmpty()) throw ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "No items recognized")

        val entities = result.items.map { item ->
            ReceiptItemEntity(
                id = UUID.randomUUID(),
                sessionId = session.id,
                name = item.name,
                price = item.price,
                quantity = item.quantity,
                uploadedBy = participant.id
            )
        }
        return itemRepository.saveAll(entities).collectList().awaitSingle().map { it.toDto(emptyList()) }
    }

    @PostMapping("/{id}/participants")
    suspend fun addParticipant(
        @PathVariable id: UUID,
        @RequestBody request: AddParticipantRequest,
        exchange: ServerWebExchange
    ): ParticipantDto {
        exchange.telegramUserId() // auth check
        val name = request.name.trim()
        if (name.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name required")
        sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
        return participantRepository.save(Participant.guest(id, name)).awaitSingle().toDto()
    }

    @PutMapping("/{id}/items/{itemId}/assignment")
    suspend fun setAssignment(
        @PathVariable id: UUID,
        @PathVariable itemId: UUID,
        @RequestBody request: ItemAssignmentRequest,
        exchange: ServerWebExchange
    ): ItemDto {
        exchange.telegramUserId() // auth check
        val item = itemRepository.findById(itemId).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
        if (item.sessionId != id) throw ResponseStatusException(HttpStatus.NOT_FOUND)

        val rosterIds = participantRepository.findBySessionId(id).collectList().awaitSingle()
            .map { it.id }.toSet()
        if (request.payerId !in rosterIds)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "payer not in session")
        val sharerIds = request.sharerIds.distinct()
        if (!rosterIds.containsAll(sharerIds))
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "sharer not in session")

        val updated = item.copy(uploadedBy = request.payerId)
        itemRepository.save(updated).awaitSingle()

        claimRepository.deleteByItemId(itemId).awaitSingleOrNull()
        if (sharerIds.isNotEmpty()) {
            claimRepository.saveAll(sharerIds.map { Claim.create(itemId, it) })
                .collectList().awaitSingle()
        }
        return updated.toDto(sharerIds)
    }

    @GetMapping("/{id}/results")
    suspend fun getResults(@PathVariable id: UUID, exchange: ServerWebExchange): ResultsDto {
        exchange.telegramUserId() // auth check only

        val participants = participantRepository.findBySessionId(id).collectList().awaitSingle()
        val items = itemRepository.findBySessionId(id).collectList().awaitSingle()
        val allClaims = claimRepository.findAllBySessionId(id).collectList().awaitSingle()

        val claimsByItem: Map<UUID, List<Claim>> = allClaims.groupBy { it.itemId }
        val claimsByParticipant: Map<UUID, List<Claim>> = allClaims.groupBy { it.participantId }

        val summaries = participants.map { p ->
            val totalAmount = (claimsByParticipant[p.id] ?: emptyList())
                .mapNotNull { claim -> items.find { it.id == claim.itemId } }
                .sumOf { item ->
                    val claimCount = (claimsByItem[item.id]?.size ?: 1).coerceAtLeast(1)
                    item.price.multiply(BigDecimal(item.quantity))
                        .divide(BigDecimal(claimCount), 2, RoundingMode.HALF_UP)
                }
            ParticipantSummaryDto(
                id = p.id,
                displayName = p.guestName ?: "User ${p.telegramId}",
                totalAmount = totalAmount
            )
        }

        val balances = participants.map { p ->
            val paid = items.filter { it.uploadedBy == p.id }
                .sumOf { it.price.multiply(BigDecimal(it.quantity)) }

            val owedFromPaidItems = (claimsByParticipant[p.id] ?: emptyList())
                .mapNotNull { claim -> items.find { it.id == claim.itemId && it.uploadedBy != null } }
                .sumOf { item ->
                    val claimCount = (claimsByItem[item.id]?.size ?: 1).coerceAtLeast(1)
                    item.price.multiply(BigDecimal(item.quantity))
                        .divide(BigDecimal(claimCount), 2, RoundingMode.HALF_UP)
                }

            ParticipantBalance(
                participantId = p.id,
                displayName = p.guestName ?: "User ${p.telegramId}",
                balance = paid.subtract(owedFromPaidItems)
            )
        }

        val transfers = debtCalculator.calculate(balances).map { t ->
            TransferDto(t.fromId, t.fromName, t.toId, t.toName, t.amount)
        }

        return ResultsDto(participants = summaries, transfers = transfers)
    }

    private fun ServerWebExchange.telegramUserId(): Long =
        getAttribute<Long>("telegramUserId")
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED)

    private fun ReceiptItemEntity.toDto(sharerIds: List<UUID>) =
        ItemDto(id, name, price, quantity, uploadedBy, sharerIds)

    private fun Participant.toDto() =
        ParticipantDto(id, guestName ?: "User $telegramId", guestName != null)
}
