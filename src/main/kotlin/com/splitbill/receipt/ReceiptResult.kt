package com.splitbill.receipt

data class ReceiptResult(
    val items: List<ReceiptItem>,
    val currency: String,
    val confidence: Double
)
