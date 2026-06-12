package com.splitbill.webapp

import com.splitbill.session.SplitSession
import com.splitbill.session.SplitSessionRepository
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
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
}
