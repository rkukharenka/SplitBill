package com.splitbill.receipt

data class ReceiptResult(
    val items: List<ReceiptItem>,
    val currency: String = "BYN",
    val confidence: Double = 0.0
)
