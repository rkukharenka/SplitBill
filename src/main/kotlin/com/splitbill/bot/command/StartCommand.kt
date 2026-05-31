package com.splitbill.bot.command

import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.generics.TelegramClient

@Component
class StartCommand(private val telegramClient: TelegramClient) {

    fun handle(update: Update) {
        val message = SendMessage.builder()
            .chatId(update.message.chatId.toString())
            .text(
                """
                Привет! Я помогу разделить счёт в ресторане.

                Что умею:
                • Распознаю чек по фото (Claude Vision)
                • Каждый выбирает свои блюда в Mini App
                • Рассчитываю, кто сколько должен

                /newsplit — начать новое разделение
                /help — подробная инструкция
                """.trimIndent()
            )
            .build()
        telegramClient.execute(message)
    }
}
