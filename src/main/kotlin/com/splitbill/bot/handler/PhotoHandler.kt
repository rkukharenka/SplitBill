package com.splitbill.bot.handler

import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.generics.TelegramClient

// Placeholder — Stage 3 wires in ReceiptParserService (Claude Vision)
@Component
class PhotoHandler(private val telegramClient: TelegramClient) {

    fun handle(update: Update) {
        val message = SendMessage.builder()
            .chatId(update.message.chatId.toString())
            .text("Фото получено. Обрабатываю чек...")
            .build()
        telegramClient.execute(message)
    }
}
