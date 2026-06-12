package com.splitbill.bot.command

import com.splitbill.config.BotProperties
import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardRow
import org.telegram.telegrambots.meta.api.objects.webapp.WebAppInfo
import org.telegram.telegrambots.meta.generics.TelegramClient
import java.util.UUID

@Component
class StartCommand(
    private val telegramClient: TelegramClient,
    private val botProperties: BotProperties
) {

    fun handle(update: Update) {
        val chatId = update.message.chatId

        // "/start <sessionId>" deep link — sent when the user taps the group "Открыть приложение"
        // button (t.me/<bot>?start=<sessionId>). This opens a private chat, where a web_app button
        // is valid, so we can launch the Mini App directly here.
        val payload = update.message.text.trim().substringAfter(" ", "").trim()
        val sessionId = payload.takeIf { it.isNotEmpty() }?.let { runCatching { UUID.fromString(it) }.getOrNull() }

        if (sessionId != null) {
            val button = InlineKeyboardButton.builder()
                .text("Открыть приложение")
                .webApp(WebAppInfo("${botProperties.webappUrl}/webapp/index.html?session=$sessionId"))
                .build()
            telegramClient.execute(
                SendMessage.builder()
                    .chatId(chatId.toString())
                    .text("Сессия открыта. Нажмите, чтобы добавить позиции и разделить счёт.")
                    .replyMarkup(InlineKeyboardMarkup(listOf(InlineKeyboardRow(button))))
                    .build()
            )
            return
        }

        telegramClient.execute(
            SendMessage.builder()
                .chatId(chatId.toString())
                .text(
                    """
                    Привет! Я помогу разделить счёт.

                    Как это работает:
                    • /newsplit создаёт сессию и кнопку «Открыть приложение»
                    • В приложении добавляете позиции (фото чека или вручную)
                    • Отмечаете кто платил и между кем делится каждая позиция
                    • Итоги показывают, кто кому сколько должен

                    /newsplit — начать новое разделение
                    /help — подробная инструкция
                    """.trimIndent()
                )
                .build()
        )
    }
}
