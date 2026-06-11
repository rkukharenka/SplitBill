package com.splitbill.webapp

import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.UUID

data class ParticipantBalance(
    val participantId: UUID,
    val displayName: String,
    val balance: BigDecimal
)

data class Transfer(
    val fromId: UUID,
    val fromName: String,
    val toId: UUID,
    val toName: String,
    val amount: BigDecimal
)

@Service
class DebtCalculatorService {

    private val threshold = BigDecimal("0.01")

    fun calculate(balances: List<ParticipantBalance>): List<Transfer> {
        data class M(val id: UUID, val name: String, var amount: BigDecimal)

        val mutable = balances.map { M(it.participantId, it.displayName, it.balance) }.toMutableList()
        val transfers = mutableListOf<Transfer>()

        while (true) {
            val debtor = mutable.minByOrNull { it.amount }
                ?.takeIf { it.amount < threshold.negate() } ?: break
            val creditor = mutable.maxByOrNull { it.amount }
                ?.takeIf { it.amount > threshold } ?: break

            val amount = debtor.amount.abs().min(creditor.amount)
            transfers.add(Transfer(debtor.id, debtor.name, creditor.id, creditor.name, amount))

            debtor.amount = debtor.amount.add(amount)
            creditor.amount = creditor.amount.subtract(amount)
        }

        return transfers
    }
}
