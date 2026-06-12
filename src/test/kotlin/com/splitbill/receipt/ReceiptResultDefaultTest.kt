package com.splitbill.receipt

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ReceiptResultDefaultTest {
    @Test
    fun `default currency is BYN`() {
        assertEquals("BYN", ReceiptResult(items = emptyList()).currency)
    }
}
