package com.splitbill.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "claude")
data class ClaudeProperties(
    val apiKey: String,
    val haikuModel: String,
    val sonnetModel: String
)
