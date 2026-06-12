package com.splitbill.participant

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.PersistenceCreator
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.time.Instant
import java.util.UUID

@Table("participants")
data class Participant(
    @field:Id @get:JvmName("_id") val id: UUID,
    @Column("session_id") val sessionId: UUID,
    @Column("telegram_id") val telegramId: Long? = null,
    @Column("guest_name") val guestName: String? = null,
    @Column("display_name") val displayName: String? = null,
    @Column("payment_requisites") val paymentRequisites: String? = null,
    @Column("joined_at") val joinedAt: Instant = Instant.now(),
    @Transient val isNewEntity: Boolean = true
) : Persistable<UUID> {
    @PersistenceCreator
    constructor(
        id: UUID,
        sessionId: UUID,
        telegramId: Long?,
        guestName: String?,
        displayName: String?,
        paymentRequisites: String?,
        joinedAt: Instant
    ) : this(id, sessionId, telegramId, guestName, displayName, paymentRequisites, joinedAt, isNewEntity = false)

    override fun getId(): UUID = id
    override fun isNew(): Boolean = isNewEntity

    companion object {
        fun telegram(sessionId: UUID, telegramId: Long, displayName: String? = null): Participant =
            Participant(id = UUID.randomUUID(), sessionId = sessionId, telegramId = telegramId, displayName = displayName)

        fun guest(sessionId: UUID, guestName: String): Participant =
            Participant(id = UUID.randomUUID(), sessionId = sessionId, guestName = guestName)
    }
}
