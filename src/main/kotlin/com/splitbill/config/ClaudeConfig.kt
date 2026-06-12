package com.splitbill.config

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
@EnableConfigurationProperties(ClaudeProperties::class)
class ClaudeConfig {

    @Bean
    fun anthropicClient(props: ClaudeProperties): AnthropicClient =
        AnthropicOkHttpClient.builder()
            .apiKey(props.apiKey)
            .build()
}
