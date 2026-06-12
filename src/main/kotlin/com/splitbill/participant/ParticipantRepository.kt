package com.splitbill.participant

import org.springframework.data.r2dbc.repository.R2dbcRepository
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono
import java.util.UUID

interface ParticipantRepository : R2dbcRepository<Participant, UUID> {

    fun findBySessionId(sessionId: UUID): Flux<Participant>

    fun findBySessionIdAndTelegramId(sessionId: UUID, telegramId: Long): Mono<Participant>
}
