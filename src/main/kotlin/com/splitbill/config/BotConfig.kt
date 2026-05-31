package com.splitbill.config

import com.splitbill.bot.SplitBillBot
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.telegram.telegrambots.client.okhttp.OkHttpTelegramClient
import org.telegram.telegrambots.longpolling.TelegramBotsLongPollingApplication
import org.telegram.telegrambots.meta.generics.TelegramClient

// Kotlin note: TelegramClient is a Java interface — @Bean returns the implementation OkHttpTelegramClient

@Configuration
@EnableConfigurationProperties(BotProperties::class)
class BotConfig {

    @Bean
    fun telegramClient(props: BotProperties): TelegramClient =
        OkHttpTelegramClient(props.token)

    // Long polling only in non-test, non-prod profiles — prod uses webhook instead
    @Bean
    @Profile("!test & !prod")
    fun botsApplication(bot: SplitBillBot, props: BotProperties): TelegramBotsLongPollingApplication {
        val app = TelegramBotsLongPollingApplication()
        app.registerBot(props.token, bot)
        return app
    }
}
