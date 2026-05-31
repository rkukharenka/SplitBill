package com.splitbill.config

import org.springframework.boot.context.properties.ConfigurationProperties

// data class — Kotlin idiom: immutable value holder with auto-generated equals/hashCode/copy/toString
@ConfigurationProperties(prefix = "telegram.bot")
data class BotProperties(
    val token: String,
    val username: String,
    val webhookUrl: String = ""
)
