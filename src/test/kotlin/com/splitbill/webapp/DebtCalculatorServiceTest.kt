package com.splitbill.webapp

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.util.UUID

class DebtCalculatorServiceTest {
    private val service = DebtCalculatorService()

    private fun balance(name: String, balance: Double) = ParticipantBalance(
        participantId = UUID.randomUUID(),
        displayName = name,
        balance = BigDecimal(balance.toString())
    )

    @Test
    fun `two people - one paid more - one transfer`() {
        val alice = balance("Alice", 100.0)
        val bob = balance("Bob", -50.0)

        val transfers = service.calculate(listOf(alice, bob))

        assertEquals(1, transfers.size)
        assertEquals("Bob", transfers[0].fromName)
        assertEquals("Alice", transfers[0].toName)
        assertEquals(BigDecimal("50.0"), transfers[0].amount)
    }

    @Test
    fun `three people - optimal transfers`() {
        val a = balance("A", 30.0)
        val b = balance("B", -10.0)
        val c = balance("C", -20.0)

        val transfers = service.calculate(listOf(a, b, c))

        assertEquals(2, transfers.size)
        val total = transfers.sumOf { it.amount }
        assertEquals(BigDecimal("30.0"), total)
        assertTrue(transfers.all { it.toName == "A" })
    }

    @Test
    fun `equal balances produce no transfers`() {
        val a = balance("A", 0.0)
        val b = balance("B", 0.0)

        val transfers = service.calculate(listOf(a, b))

        assertTrue(transfers.isEmpty())
    }

    @Test
    fun `small rounding differences ignored`() {
        val a = balance("A", 0.005)
        val b = balance("B", -0.005)

        val transfers = service.calculate(listOf(a, b))

        assertTrue(transfers.isEmpty(), "Sub-cent differences should not generate transfers")
    }
}
