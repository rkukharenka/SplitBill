package com.splitbill.receipt

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Table("receipt_items")
data class ReceiptItemEntity(
    @field:Id @get:JvmName("_id") val id: UUID,
    @Column("session_id") val sessionId: UUID,
    val name: String,
    val price: BigDecimal,
    val quantity: Int = 1,
    @Column("uploaded_by") val uploadedBy: UUID? = null,
    @Column("created_at") val createdAt: Instant = Instant.now(),
    @Transient val isNewEntity: Boolean = true
) : Persistable<UUID> {
    override fun getId(): UUID = id
    override fun isNew(): Boolean = isNewEntity

    companion object {
        fun from(item: ReceiptItem, sessionId: UUID, uploadedBy: UUID? = null): ReceiptItemEntity =
            ReceiptItemEntity(
                id = UUID.randomUUID(),
                sessionId = sessionId,
                name = item.name,
                price = item.price,
                quantity = item.quantity,
                uploadedBy = uploadedBy
            )
    }
}
