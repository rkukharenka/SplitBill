package com.splitbill.webapp

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.net.URLEncoder
import java.time.Instant
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class WebAppAuthFilterTest {

    private val botToken = "test-token-stub"
    private val filter = WebAppAuthFilter(botToken)

    companion object {
        fun buildValidInitData(botToken: String, userId: Long, firstName: String = "Test"): String {
            val userJson = """{"id":$userId,"first_name":"$firstName"}"""
            val encodedUser = URLEncoder.encode(userJson, "UTF-8")
            val authDate = Instant.now().epochSecond.toString()

            // data_check_string signs DECODED values (Telegram spec)
            val signParams = sortedMapOf("auth_date" to authDate, "user" to userJson)
            val dataCheckString = signParams.entries.joinToString("\n") { "${it.key}=${it.value}" }

            val secretKey = hmacSha256("WebAppData".toByteArray(), botToken.toByteArray())
            val hash = hmacSha256(secretKey, dataCheckString.toByteArray()).toHex()

            // querystring carries ENCODED values
            val queryParams = sortedMapOf("auth_date" to authDate, "user" to encodedUser)
            return queryParams.entries.joinToString("&") { "${it.key}=${it.value}" } + "&hash=$hash"
        }

        private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(key, "HmacSHA256"))
            return mac.doFinal(data)
        }

        private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
    }

    @Test
    fun `valid initData returns user id`() {
        val initData = buildValidInitData(botToken, userId = 42L)
        val result = filter.validateAndExtractUserId(initData)
        assertEquals(42L, result)
    }

    @Test
    fun `wrong bot token returns null`() {
        val initData = buildValidInitData("wrong-token", userId = 42L)
        val result = filter.validateAndExtractUserId(initData)
        assertNull(result)
    }

    @Test
    fun `tampered hash returns null`() {
        val initData = buildValidInitData(botToken, userId = 42L)
        val tampered = initData.replace(Regex("hash=[a-f0-9]+"), "hash=deadbeef")
        val result = filter.validateAndExtractUserId(tampered)
        assertNull(result)
    }

    @Test
    fun `missing hash returns null`() {
        val result = filter.validateAndExtractUserId("auth_date=1234567890&user=%7B%22id%22%3A1%7D")
        assertNull(result)
    }
}
