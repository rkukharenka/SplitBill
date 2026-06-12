package com.splitbill.bot.command

import com.splitbill.config.BotProperties
import com.splitbill.session.SplitSessionService
import kotlinx.coroutines.runBlocking
import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.GetMe
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
    // Resolve the real bot username from the token via getMe (cached), so the startapp
    // deep link always points at THIS bot — not whatever TELEGRAM_BOT_USERNAME env holds.
    private val botUsername: String by lazy {
        runCatching { telegramClient.execute(GetMe()).userName }.getOrNull()?.takeIf { it.isNotBlank() }
            ?.removePrefix("@") ?: botProperties.username.removePrefix("@")
    }

    fun handle(update: Update) {
        val chatId = update.message.chatId
        val creatorId = update.message.from.id

        val session = runBlocking {
            sessionService.createEmptySession(
                creatorTelegramId = creatorId,
                currency = "BYN",
                chatId = chatId
            )
        }

        // Inline web_app buttons are only valid in PRIVATE chats. In groups/channels Telegram
        // rejects them with BUTTON_TYPE_INVALID, so launch the Mini App via a startapp deep link.
        val button = if (chatId > 0) {
            InlineKeyboardButton.builder()
                .text("Открыть приложение")
                .webApp(WebAppInfo("${botProperties.webappUrl}/webapp/index.html?session=${session.id}"))
                .build()
        } else {
            // Open the bot in private via a /start deep link; StartCommand then shows a web_app
            // button there. Avoids needing a BotFather Main Mini App for in-group launch.
            InlineKeyboardButton.builder()
                .text("Открыть приложение")
                .url("https://t.me/$botUsername?start=${session.id}")
                .build()
        }

        val message = SendMessage.builder()
            .chatId(chatId.toString())
            .text("Сессия создана! Откройте приложение, чтобы добавить позиции и разделить счёт.")
            .replyMarkup(InlineKeyboardMarkup(listOf(InlineKeyboardRow(button))))
            .build()

        telegramClient.execute(message)
    }
}
