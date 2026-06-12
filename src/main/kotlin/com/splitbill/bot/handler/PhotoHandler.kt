package com.splitbill.bot.handler

import com.splitbill.receipt.ReceiptParserService
import com.splitbill.receipt.ReceiptResult
import com.splitbill.session.SplitSession
import com.splitbill.session.SplitSessionService
import kotlinx.coroutines.runBlocking
import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.GetFile
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.generics.TelegramClient
import java.math.BigDecimal

@Component
class PhotoHandler(
    private val telegramClient: TelegramClient,
    private val parserService: ReceiptParserService,
    private val sessionService: SplitSessionService
) {
    fun handle(update: Update) {
        val chatId = update.message.chatId.toString()
        val userId = update.message.from.id

        send(chatId, "Обрабатываю чек... ⏳")

        try {
            val photo = update.message.photo.maxByOrNull { it.fileSize ?: 0 }!!
            val fileInfo = telegramClient.execute(GetFile(photo.fileId))
            val imageBytes = telegramClient.downloadFileAsStream(fileInfo).readBytes()

            val result = parserService.parse(imageBytes, "image/jpeg")

            if (result.items.isEmpty()) {
                send(chatId, "Не удалось распознать позиции в чеке. Попробуйте сделать более чёткое фото.")
                return
            }

            val session = runBlocking {
                sessionService.createSession(userId, result.currency, result.items)
            }

            send(chatId, buildResultMessage(session, result))
        } catch (e: Exception) {
            send(chatId, "Ошибка при обработке чека. Попробуйте ещё раз.")
        }
    }

    private fun send(chatId: String, text: String) {
        telegramClient.execute(
            SendMessage.builder()
                .chatId(chatId)
                .text(text)
                .build()
        )
    }

    private fun buildResultMessage(session: SplitSession, result: ReceiptResult): String {
        val sb = StringBuilder()
        sb.appendLine("✅ Чек распознан! Сессия создана.")
        sb.appendLine()
        sb.appendLine("Позиции:")
        result.items.forEachIndexed { i, item ->
            if (item.quantity > 1) {
                sb.appendLine("${i + 1}. ${item.name} — ${item.quantity} × ${item.price} ${result.currency}")
            } else {
                sb.appendLine("${i + 1}. ${item.name} — ${item.price} ${result.currency}")
            }
        }
        sb.appendLine()
        val total = result.items.sumOf { it.price.multiply(BigDecimal(it.quantity)) }
        sb.appendLine("Итого: $total ${result.currency}")
        sb.appendLine()
        sb.appendLine("ID сессии: ${session.id}")
        return sb.toString().trimEnd()
    }
}
