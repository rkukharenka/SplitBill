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

                1. /newsplit — создать разделение (работает в группе и в личке)
                2. Нажми «Открыть приложение»
                3. Добавь позиции: загрузи фото чека или введи вручную
                4. Для каждой позиции выбери, кто платил и кто делит
                5. Гостей без Telegram добавляй по имени кнопкой «+ Гость»
                6. Открой «Итоги» — увидишь, кто кому сколько должен

                Ограничения:
                • Сессия хранится 48 часов, потом удаляется
                """.trimIndent()
            )
            .build()
        telegramClient.execute(message)
    }
}
