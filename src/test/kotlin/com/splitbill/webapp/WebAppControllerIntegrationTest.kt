package com.splitbill.webapp

import com.splitbill.session.SplitSession
import com.splitbill.session.SplitSessionRepository
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.util.UUID
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@ActiveProfiles("test")
@Testcontainers
class WebAppControllerIntegrationTest {

    @Autowired
    lateinit var client: WebTestClient

    @Autowired
    lateinit var sessionRepository: SplitSessionRepository

    @Autowired
    lateinit var itemRepository: com.splitbill.receipt.ReceiptItemRepository

    @Autowired
    lateinit var participantRepository: com.splitbill.participant.ParticipantRepository

    @Autowired
    lateinit var claimRepository: com.splitbill.split.ClaimRepository

    companion object {
        private const val BOT_TOKEN = "test-token-stub"

        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer<Nothing>("postgres:17-alpine").apply {
            withDatabaseName("splitbill_test")
            withUsername("splitbill")
            withPassword("splitbill")
        }

        @Container
        @JvmStatic
        val redis = GenericContainer<Nothing>("redis:7-alpine").apply { withExposedPorts(6379) }

        @DynamicPropertySource
        @JvmStatic
        fun props(registry: DynamicPropertyRegistry) {
            registry.add("spring.r2dbc.url") {
                "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}"
            }
            registry.add("spring.r2dbc.username") { postgres.username }
            registry.add("spring.r2dbc.password") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
            registry.add("spring.data.redis.host") { redis.host }
            registry.add("spring.data.redis.port") { redis.firstMappedPort.toString() }
        }
    }

    @Test
    fun `GET session returns 200 with valid initData`() {
        val session = runBlocking {
            sessionRepository.save(
                SplitSession.create(creatorTelegramId = 42L, currency = "RUB")
            ).awaitSingle()
        }

        val initData = WebAppAuthFilterTest.buildValidInitData(BOT_TOKEN, userId = 42L)

        client.get()
            .uri("/api/webapp/sessions/${session.id}")
            .header("X-Telegram-Init-Data", initData)
            .exchange()
            .expectStatus().isOk
    }

    @Test
    fun `add guest then GET returns guest in roster`() {
        val session = runBlocking {
            sessionRepository.save(SplitSession.create(creatorTelegramId = 1L, currency = "BYN")).awaitSingle()
        }
        val initData = WebAppAuthFilterTest.buildValidInitData(BOT_TOKEN, userId = 1L)

        client.post()
            .uri("/api/webapp/sessions/${session.id}/participants")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("name" to "Vasya"))
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.displayName").isEqualTo("Vasya")
            .jsonPath("$.isGuest").isEqualTo(true)

        client.get()
            .uri("/api/webapp/sessions/${session.id}")
            .header("X-Telegram-Init-Data", initData)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.participants[?(@.displayName == 'Vasya')].isGuest").isEqualTo(true)
    }

    @Test
    fun `set assignment updates payer and sharers`() {
        val session = runBlocking {
            sessionRepository.save(SplitSession.create(creatorTelegramId = 2L, currency = "BYN")).awaitSingle()
        }
        val initData = WebAppAuthFilterTest.buildValidInitData(BOT_TOKEN, userId = 2L)

        client.get().uri("/api/webapp/sessions/${session.id}")
            .header("X-Telegram-Init-Data", initData).exchange().expectStatus().isOk

        val callerId = runBlocking {
            participantRepository.findBySessionIdAndTelegramId(session.id, 2L).awaitSingle().id
        }

        val addBody = client.post()
            .uri("/api/webapp/sessions/${session.id}/items")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("name" to "Pizza", "price" to 30.0, "quantity" to 1))
            .exchange().expectStatus().isOk
            .expectBody().jsonPath("$.payerId").isEqualTo(callerId.toString())
            .returnResult().responseBody!!.let { String(it) }
        val itemId = Regex("\"id\":\"([0-9a-f-]+)\"").find(addBody)!!.groupValues[1]

        client.put()
            .uri("/api/webapp/sessions/${session.id}/items/$itemId/assignment")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("payerId" to callerId.toString(), "sharerIds" to listOf(callerId.toString())))
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.payerId").isEqualTo(callerId.toString())
            .jsonPath("$.sharerIds[0]").isEqualTo(callerId.toString())
    }

    @Test
    fun `assignment with unknown payer is rejected`() {
        val session = runBlocking {
            sessionRepository.save(SplitSession.create(creatorTelegramId = 3L, currency = "BYN")).awaitSingle()
        }
        val initData = WebAppAuthFilterTest.buildValidInitData(BOT_TOKEN, userId = 3L)
        client.get().uri("/api/webapp/sessions/${session.id}")
            .header("X-Telegram-Init-Data", initData).exchange().expectStatus().isOk

        val addBody = client.post()
            .uri("/api/webapp/sessions/${session.id}/items")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("name" to "Beer", "price" to 5.0, "quantity" to 1))
            .exchange().expectStatus().isOk
            .expectBody().returnResult().responseBody!!.let { String(it) }
        val itemId = Regex("\"id\":\"([0-9a-f-]+)\"").find(addBody)!!.groupValues[1]

        client.put()
            .uri("/api/webapp/sessions/${session.id}/items/$itemId/assignment")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("payerId" to UUID.randomUUID().toString(), "sharerIds" to emptyList<String>()))
            .exchange()
            .expectStatus().isBadRequest
    }
}
