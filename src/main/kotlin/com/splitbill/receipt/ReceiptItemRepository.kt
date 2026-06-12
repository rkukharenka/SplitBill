package com.splitbill.receipt

import org.springframework.data.r2dbc.repository.R2dbcRepository
import reactor.core.publisher.Flux
import java.util.UUID

interface ReceiptItemRepository : R2dbcRepository<ReceiptItemEntity, UUID> {

    fun findBySessionId(sessionId: UUID): Flux<ReceiptItemEntity>
}
