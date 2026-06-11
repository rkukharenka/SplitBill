package com.splitbill.split

import org.springframework.data.r2dbc.repository.Modifying
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.r2dbc.repository.R2dbcRepository
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono
import java.util.UUID

interface ClaimRepository : R2dbcRepository<Claim, UUID> {

    fun findByParticipantId(participantId: UUID): Flux<Claim>

    fun findByItemId(itemId: UUID): Flux<Claim>

    @Query("SELECT c.* FROM claims c JOIN receipt_items ri ON c.item_id = ri.id WHERE ri.session_id = :sessionId")
    fun findAllBySessionId(sessionId: UUID): Flux<Claim>

    @Modifying
    @Query("DELETE FROM claims WHERE participant_id = :participantId AND item_id IN (SELECT id FROM receipt_items WHERE session_id = :sessionId)")
    fun deleteByParticipantIdAndSessionId(participantId: UUID, sessionId: UUID): Mono<Long>
}
