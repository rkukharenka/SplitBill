package com.splitbill.bot.command

import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.generics.TelegramClient

@Component
class NewSplitCommand(private val telegramClient: TelegramClient) {

    fun handle(update: Update) {
        val message = SendMessage.builder()
            .chatId(update.message.chatId.toString())
            .text("Отправь фото чека — я распознаю позиции и создам сессию.")
            .build()
        telegramClient.execute(message)
    }
}
