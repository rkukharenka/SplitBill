package com.splitbill.session

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.math.BigDecimal
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Table("split_sessions")
data class SplitSession(
    @field:Id @get:JvmName("_id") val id: UUID,
    @Column("creator_telegram_id") val creatorTelegramId: Long,
    val status: String = "ACTIVE",
    val currency: String = "RUB",
    @Column("tip_percent") val tipPercent: BigDecimal = BigDecimal.ZERO,
    @Column("chat_id") val chatId: Long? = null,
    @Column("created_at") val createdAt: Instant = Instant.now(),
    @Column("expires_at") val expiresAt: Instant,
    @Transient val isNewEntity: Boolean = true
) : Persistable<UUID> {
    override fun getId(): UUID = id
    override fun isNew(): Boolean = isNewEntity

    companion object {
        fun create(creatorTelegramId: Long, currency: String, chatId: Long? = null): SplitSession =
            SplitSession(
                id = UUID.randomUUID(),
                creatorTelegramId = creatorTelegramId,
                currency = currency,
                chatId = chatId,
                expiresAt = Instant.now().plus(48, ChronoUnit.HOURS)
            )
    }
}
