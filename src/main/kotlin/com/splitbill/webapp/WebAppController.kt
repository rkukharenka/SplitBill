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

        val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
            ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

        val items = itemRepository.findBySessionId(id).collectList().awaitSingle()
        val myClaims = claimRepository.findByParticipantId(participant.id).collectList().awaitSingle()

        return SessionDto(
            id = session.id,
            currency = session.currency,
            status = session.status,
            items = items.map { it.toDto() },
            myParticipantId = participant.id,
            myClaimedItemIds = myClaims.map { it.itemId }
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
        return itemRepository.save(entity).awaitSingle().toDto()
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
        return itemRepository.saveAll(entities).collectList().awaitSingle().map { it.toDto() }
    }

    private fun ServerWebExchange.telegramUserId(): Long =
        getAttribute<Long>("telegramUserId")
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED)

    private fun ReceiptItemEntity.toDto() = ItemDto(id, name, price, quantity, uploadedBy)
}
