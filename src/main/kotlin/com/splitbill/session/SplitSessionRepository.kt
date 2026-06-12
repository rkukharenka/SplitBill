package com.splitbill.session

import org.springframework.data.r2dbc.repository.Modifying
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.r2dbc.repository.R2dbcRepository
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono
import java.time.Instant
import java.util.UUID

interface SplitSessionRepository : R2dbcRepository<SplitSession, UUID> {

    fun findByCreatorTelegramIdAndStatus(creatorTelegramId: Long, status: String): Flux<SplitSession>

    @Modifying
    @Query("UPDATE split_sessions SET status = 'EXPIRED' WHERE expires_at < :now AND status = 'ACTIVE'")
    fun expireOldSessions(now: Instant): Mono<Long>
}
