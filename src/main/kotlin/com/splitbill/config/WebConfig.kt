package com.splitbill.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.web.reactive.function.server.RouterFunction
import org.springframework.web.reactive.function.server.RouterFunctions
import org.springframework.web.reactive.function.server.ServerResponse

// WebFlux serves static files but does not map the directory path "/webapp/" to
// webapp/index.html. This router makes "/webapp" and "/webapp/" return the SPA entry
// point so both the bot link and any bare directory link work. Query params (e.g.
// ?session=...) pass through to the client-side app automatically.
@Configuration
class WebConfig {

    @Bean
    fun webappIndexRouter(): RouterFunction<ServerResponse> {
        val index = ClassPathResource("static/webapp/index.html")
        return RouterFunctions.route()
            .GET("/webapp") { ServerResponse.ok().contentType(MediaType.TEXT_HTML).bodyValue(index) }
            .GET("/webapp/") { ServerResponse.ok().contentType(MediaType.TEXT_HTML).bodyValue(index) }
            .build()
    }
}
