package com.splitbill.receipt

import java.math.BigDecimal

data class ReceiptItem(
    val name: String,
    val price: BigDecimal,
    val quantity: Int = 1
)
