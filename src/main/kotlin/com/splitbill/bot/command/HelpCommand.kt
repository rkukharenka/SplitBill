package com.splitbill.bot.command

import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.generics.TelegramClient

@Component
class HelpCommand(private val telegramClient: TelegramClient) {

    fun handle(update: Update) {
        val message = SendMessage.builder()
            .chatId(update.message.chatId.toString())
            .text(
                """
                Как пользоваться SplitBill:

                1. /newsplit — создать новое разделение
                2. Отправь фото чека
                3. Открой Mini App — каждый выбирает свои блюда
                4. Смотри итоги, скопируй реквизиты и сумму для перевода

                Ограничения:
                • До 20 участников, до 100 позиций
                • Сессия хранится 48 часов, потом удаляется
                • Гости входят по имени (без Telegram аккаунта)
                """.trimIndent()
            )
            .build()
        telegramClient.execute(message)
    }
}
