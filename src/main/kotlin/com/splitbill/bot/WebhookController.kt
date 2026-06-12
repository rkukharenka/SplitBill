package com.splitbill.bot

import com.splitbill.config.BotProperties
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Profile
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import org.telegram.telegrambots.meta.api.methods.updates.SetWebhook
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.generics.TelegramClient

@RestController
@Profile("prod")
class WebhookController(
    private val bot: SplitBillBot,
    private val telegramClient: TelegramClient,
    private val props: BotProperties
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostConstruct
    fun registerWebhook() {
        try {
            telegramClient.execute(
                SetWebhook.builder()
                    .url("${props.webhookUrl}/webhook")
                    .build()
            )
            log.info("Webhook registered: ${props.webhookUrl}/webhook")
        } catch (e: Exception) {
            log.warn("Webhook registration failed on startup (will retry on next restart): ${e.message}")
        }
    }

    @PostMapping("/webhook")
    fun handleUpdate(@RequestBody update: Update): ResponseEntity<Void> {
        bot.consume(update)
        return ResponseEntity.ok().build()
    }
}
