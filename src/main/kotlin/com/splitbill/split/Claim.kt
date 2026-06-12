package com.splitbill.split

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.time.Instant
import java.util.UUID

@Table("claims")
data class Claim(
    @field:Id @get:JvmName("_id") val id: UUID,
    @Column("item_id") val itemId: UUID,
    @Column("participant_id") val participantId: UUID,
    @Column("created_at") val createdAt: Instant = Instant.now(),
    @Transient val isNewEntity: Boolean = true
) : Persistable<UUID> {
    override fun getId(): UUID = id
    override fun isNew(): Boolean = isNewEntity

    companion object {
        fun create(itemId: UUID, participantId: UUID): Claim =
            Claim(id = UUID.randomUUID(), itemId = itemId, participantId = participantId)
    }
}
