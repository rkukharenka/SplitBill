package com.splitbill.bot

import com.splitbill.bot.command.HelpCommand
import com.splitbill.bot.command.NewSplitCommand
import com.splitbill.bot.command.StartCommand
import com.splitbill.bot.handler.PhotoHandler
import org.springframework.stereotype.Component
import org.telegram.telegrambots.longpolling.util.LongPollingSingleThreadUpdateConsumer
import org.telegram.telegrambots.meta.api.objects.Update

// LongPollingSingleThreadUpdateConsumer: consume(List<Update>) dispatches to consume(Update) automatically
@Component
class SplitBillBot(
    private val startCommand: StartCommand,
    private val newSplitCommand: NewSplitCommand,
    private val helpCommand: HelpCommand,
    private val photoHandler: PhotoHandler
) : LongPollingSingleThreadUpdateConsumer {

    override fun consume(update: Update) {
        when {
            update.hasMessage() && update.message.hasText() -> handleText(update)
            update.hasMessage() && update.message.hasPhoto() -> photoHandler.handle(update)
        }
    }

    private fun handleText(update: Update) {
        // startsWith handles "/start@botname" form Telegram sends in group chats
        val text = update.message.text.trim()
        when {
            text.startsWith("/start") -> startCommand.handle(update)
            text.startsWith("/newsplit") -> newSplitCommand.handle(update)
            text.startsWith("/help") -> helpCommand.handle(update)
        }
    }
}
