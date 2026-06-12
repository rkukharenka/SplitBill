package com.splitbill.bot.command

import com.splitbill.config.BotProperties
import com.splitbill.session.SplitSessionService
import kotlinx.coroutines.runBlocking
import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardRow
import org.telegram.telegrambots.meta.api.objects.webapp.WebAppInfo
import org.telegram.telegrambots.meta.generics.TelegramClient

@Component
class NewSplitCommand(
    private val telegramClient: TelegramClient,
    private val sessionService: SplitSessionService,
    private val botProperties: BotProperties
) {
    fun handle(update: Update) {
        val chatId = update.message.chatId
        val creatorId = update.message.from.id

        val session = runBlocking {
            sessionService.createEmptySession(
                creatorTelegramId = creatorId,
                currency = "RUB",
                chatId = chatId
            )
        }

        val webappUrl = "${botProperties.webappUrl}/webapp/index.html?session=${session.id}"

        val button = InlineKeyboardButton.builder()
            .text("Открыть приложение")
            .webApp(WebAppInfo(webappUrl))
            .build()

        val message = SendMessage.builder()
            .chatId(chatId.toString())
            .text("Сессия создана! Добавляйте чеки и отмечайте свои позиции.")
            .replyMarkup(InlineKeyboardMarkup(listOf(InlineKeyboardRow(button))))
            .build()

        telegramClient.execute(message)
    }
}
