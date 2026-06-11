package com.splitbill.session

import com.splitbill.receipt.ReceiptItem
import com.splitbill.receipt.ReceiptItemEntity
import com.splitbill.receipt.ReceiptItemRepository
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class SplitSessionService(
    private val sessionRepository: SplitSessionRepository,
    private val itemRepository: ReceiptItemRepository
) {
    suspend fun createSession(creatorTelegramId: Long, currency: String, items: List<ReceiptItem>): SplitSession {
        val session = SplitSession.create(creatorTelegramId, currency)
        sessionRepository.save(session).awaitSingle()

        val entities = items.map { ReceiptItemEntity.from(it, session.id) }
        itemRepository.saveAll(entities).collectList().awaitSingle()

        return session
    }

    suspend fun createEmptySession(creatorTelegramId: Long, currency: String, chatId: Long): SplitSession {
        val session = SplitSession.create(creatorTelegramId, currency, chatId)
        sessionRepository.save(session).awaitSingle()
        return session
    }

    suspend fun findById(id: UUID): SplitSession? =
        sessionRepository.findById(id).awaitSingle()

    @Scheduled(cron = "0 0 * * * *")
    fun expireSessions() {
        sessionRepository.expireOldSessions(Instant.now()).subscribe()
    }
}
