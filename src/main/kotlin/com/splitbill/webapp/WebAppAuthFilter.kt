package com.splitbill.webapp

import com.fasterxml.jackson.databind.ObjectMapper
import com.splitbill.config.BotProperties
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.WebFilter
import org.springframework.web.server.WebFilterChain
import reactor.core.publisher.Mono
import java.net.URLDecoder
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@Component
class WebAppAuthFilter(private val botToken: String) : WebFilter {

    constructor(props: BotProperties) : this(props.token)

    private val objectMapper = ObjectMapper()

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val path = exchange.request.path.value()
        if (!path.startsWith("/api/webapp")) return chain.filter(exchange)

        val initData = exchange.request.headers.getFirst("X-Telegram-Init-Data")
            ?: return Mono.error(ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing X-Telegram-Init-Data"))

        val userId = validateAndExtractUserId(initData)
            ?: return Mono.error(ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid initData"))

        exchange.attributes["telegramUserId"] = userId
        return chain.filter(exchange)
    }

    fun validateAndExtractUserId(initData: String): Long? {
        val params = mutableMapOf<String, String>()
        for (pair in initData.split("&")) {
            val idx = pair.indexOf('=')
            if (idx < 0) continue
            params[pair.substring(0, idx)] = pair.substring(idx + 1)
        }

        val hash = params.remove("hash") ?: return null

        val dataCheckString = params.entries
            .sortedBy { it.key }
            .joinToString("\n") { "${it.key}=${it.value}" }

        val secretKey = hmacSha256("WebAppData".toByteArray(Charsets.UTF_8), botToken.toByteArray(Charsets.UTF_8))
        val expectedHash = hmacSha256(secretKey, dataCheckString.toByteArray(Charsets.UTF_8)).toHex()

        if (!MessageDigest.isEqual(hash.toByteArray(Charsets.UTF_8), expectedHash.toByteArray(Charsets.UTF_8))) return null

        val userJson = params["user"]?.let { URLDecoder.decode(it, "UTF-8") } ?: return null
        return try {
            objectMapper.readTree(userJson)?.get("id")?.asLong()
        } catch (_: Exception) {
            null
        }
    }

    private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
}
