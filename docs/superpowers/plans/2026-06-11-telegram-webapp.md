# Telegram Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Telegram Mini App (WebApp) that fully replaces text commands — group members upload receipts, claim items, and see optimized debt transfers via a browser UI.

**Architecture:** Vanilla TypeScript SPA built with Vite, output to `src/main/resources/static/webapp/` so a single JAR serves everything. Spring WebFlux REST API under `/api/webapp/*` validates Telegram `initData` via HMAC-SHA256 on every request. Bot updated to create sessions in group chats and attach a WebApp button.

**Tech Stack:** Spring Boot 3 / WebFlux / R2DBC (Kotlin coroutines), Flyway, Testcontainers + MockK for tests, Vite + TypeScript (no framework) for frontend, Telegram WebApp JS SDK.

---

## File Map

**New files:**
- `src/main/resources/db/migration/V2__add_chat_id_and_uploaded_by.sql`
- `src/main/kotlin/com/splitbill/webapp/WebAppAuthFilter.kt`
- `src/main/kotlin/com/splitbill/webapp/WebAppController.kt`
- `src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt`
- `src/main/kotlin/com/splitbill/webapp/DebtCalculatorService.kt`
- `src/test/kotlin/com/splitbill/webapp/WebAppAuthFilterTest.kt`
- `src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt`
- `webapp/package.json`
- `webapp/vite.config.ts`
- `webapp/tsconfig.json`
- `webapp/index.html`
- `webapp/src/types.ts`
- `webapp/src/api.ts`
- `webapp/src/main.ts`
- `webapp/src/screens/session.ts`
- `webapp/src/screens/results.ts`
- `webapp/src/components/addItemModal.ts`

**Modified files:**
- `src/main/resources/db/migration/V1__init.sql` — NOT modified (migration is immutable)
- `src/main/kotlin/com/splitbill/session/SplitSession.kt` — add `chatId` field
- `src/main/kotlin/com/splitbill/receipt/ReceiptItemEntity.kt` — add `uploadedBy` field
- `src/main/kotlin/com/splitbill/session/SplitSessionService.kt` — add `createEmptySession`
- `src/main/kotlin/com/splitbill/split/ClaimRepository.kt` — add two new queries
- `src/main/kotlin/com/splitbill/config/BotProperties.kt` — add `webappUrl`
- `src/main/kotlin/com/splitbill/bot/command/NewSplitCommand.kt` — group chat + WebApp button
- `src/main/resources/application.yml` — add `telegram.bot.webapp-url`
- `src/main/resources/application-local.yml` — add stub webapp-url
- `src/main/resources/application-test.yml` — add stub webapp-url
- `build.gradle.kts` — add `npmBuild` task + `bootJar` dependency

---

## Task 1: Flyway Migration — add chat_id and uploaded_by

**Files:**
- Create: `src/main/resources/db/migration/V2__add_chat_id_and_uploaded_by.sql`

- [ ] **Step 1: Create migration file**

```sql
-- chat_id links a session to the group chat where /newsplit was invoked
ALTER TABLE split_sessions ADD COLUMN chat_id BIGINT;

-- uploaded_by tracks who added an item (= who paid for it)
ALTER TABLE receipt_items ADD COLUMN uploaded_by UUID REFERENCES participants(id) ON DELETE SET NULL;

CREATE INDEX idx_items_uploaded_by ON receipt_items(uploaded_by) WHERE uploaded_by IS NOT NULL;
```

- [ ] **Step 2: Verify migration runs**

Start infra and run migrations:
```bash
docker-compose up -d
set -a && source .env && set +a
./gradlew flywayMigrate -Dflyway.url=jdbc:postgresql://localhost:5432/splitbill \
  -Dflyway.user=splitbill -Dflyway.password=splitbill
```
Expected output: `Successfully applied 1 migration to schema "public"` (V2 applied).

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V2__add_chat_id_and_uploaded_by.sql
git commit -m "feat: add chat_id to split_sessions and uploaded_by to receipt_items"
```

---

## Task 2: Update Domain Models

**Files:**
- Modify: `src/main/kotlin/com/splitbill/session/SplitSession.kt`
- Modify: `src/main/kotlin/com/splitbill/receipt/ReceiptItemEntity.kt`

- [ ] **Step 1: Add `chatId` to SplitSession**

Replace the full file:
```kotlin
package com.splitbill.session

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.math.BigDecimal
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Table("split_sessions")
data class SplitSession(
    @field:Id @get:JvmName("_id") val id: UUID,
    @Column("creator_telegram_id") val creatorTelegramId: Long,
    val status: String = "ACTIVE",
    val currency: String = "RUB",
    @Column("tip_percent") val tipPercent: BigDecimal = BigDecimal.ZERO,
    @Column("chat_id") val chatId: Long? = null,
    @Column("created_at") val createdAt: Instant = Instant.now(),
    @Column("expires_at") val expiresAt: Instant,
    @Transient val isNewEntity: Boolean = true
) : Persistable<UUID> {
    override fun getId(): UUID = id
    override fun isNew(): Boolean = isNewEntity

    companion object {
        fun create(creatorTelegramId: Long, currency: String, chatId: Long? = null): SplitSession =
            SplitSession(
                id = UUID.randomUUID(),
                creatorTelegramId = creatorTelegramId,
                currency = currency,
                chatId = chatId,
                expiresAt = Instant.now().plus(48, ChronoUnit.HOURS)
            )
    }
}
```

- [ ] **Step 2: Add `uploadedBy` to ReceiptItemEntity**

Replace the full file:
```kotlin
package com.splitbill.receipt

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Table("receipt_items")
data class ReceiptItemEntity(
    @field:Id @get:JvmName("_id") val id: UUID,
    @Column("session_id") val sessionId: UUID,
    val name: String,
    val price: BigDecimal,
    val quantity: Int = 1,
    @Column("uploaded_by") val uploadedBy: UUID? = null,
    @Column("created_at") val createdAt: Instant = Instant.now(),
    @Transient val isNewEntity: Boolean = true
) : Persistable<UUID> {
    override fun getId(): UUID = id
    override fun isNew(): Boolean = isNewEntity

    companion object {
        fun from(item: ReceiptItem, sessionId: UUID, uploadedBy: UUID? = null): ReceiptItemEntity =
            ReceiptItemEntity(
                id = UUID.randomUUID(),
                sessionId = sessionId,
                name = item.name,
                price = item.price,
                quantity = item.quantity,
                uploadedBy = uploadedBy
            )
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew compileKotlin
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/splitbill/session/SplitSession.kt \
        src/main/kotlin/com/splitbill/receipt/ReceiptItemEntity.kt
git commit -m "feat: add chatId to SplitSession and uploadedBy to ReceiptItemEntity"
```

---

## Task 3: DebtCalculatorService (TDD)

**Files:**
- Create: `src/main/kotlin/com/splitbill/webapp/DebtCalculatorService.kt`
- Create: `src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt`

- [ ] **Step 1: Write the failing tests**

```kotlin
package com.splitbill.webapp

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.util.UUID

class DebtCalculatorServiceTest {
    private val service = DebtCalculatorService()

    private fun balance(name: String, balance: Double) = ParticipantBalance(
        participantId = UUID.randomUUID(),
        displayName = name,
        balance = BigDecimal(balance)
    )

    @Test
    fun `two people - one paid more - one transfer`() {
        val alice = balance("Alice", 100.0)   // paid 100, owed 50 → balance +50
        val bob = balance("Bob", -50.0)        // paid 0, owed 50 → balance -50
        // Alice paid extra, Bob owes Alice

        val transfers = service.calculate(listOf(alice, bob))

        assertEquals(1, transfers.size)
        assertEquals("Bob", transfers[0].fromName)
        assertEquals("Alice", transfers[0].toName)
        assertEquals(BigDecimal("50.0"), transfers[0].amount)
    }

    @Test
    fun `three people - optimal transfers`() {
        // A: balance +30 (paid 30 more than consumed)
        // B: balance -10 (owes 10)
        // C: balance -20 (owes 20)
        val a = balance("A", 30.0)
        val b = balance("B", -10.0)
        val c = balance("C", -20.0)

        val transfers = service.calculate(listOf(a, b, c))

        // A gets 30 total: from B (10) and from C (20)
        assertEquals(2, transfers.size)
        val total = transfers.sumOf { it.amount }
        assertEquals(BigDecimal("30.0"), total)
        assertTrue(transfers.all { it.toName == "A" })
    }

    @Test
    fun `equal balances produce no transfers`() {
        val a = balance("A", 0.0)
        val b = balance("B", 0.0)

        val transfers = service.calculate(listOf(a, b))

        assertTrue(transfers.isEmpty())
    }

    @Test
    fun `small rounding differences ignored`() {
        val a = balance("A", 0.005)
        val b = balance("B", -0.005)

        val transfers = service.calculate(listOf(a, b))

        assertTrue(transfers.isEmpty(), "Sub-cent differences should not generate transfers")
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
./gradlew test --tests "com.splitbill.webapp.DebtCalculatorServiceTest"
```
Expected: FAIL — `DebtCalculatorService` not found.

- [ ] **Step 3: Implement DebtCalculatorService**

```kotlin
package com.splitbill.webapp

import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.UUID

data class ParticipantBalance(
    val participantId: UUID,
    val displayName: String,
    val balance: BigDecimal
)

data class Transfer(
    val fromId: UUID,
    val fromName: String,
    val toId: UUID,
    val toName: String,
    val amount: BigDecimal
)

@Service
class DebtCalculatorService {

    private val threshold = BigDecimal("0.01")

    fun calculate(balances: List<ParticipantBalance>): List<Transfer> {
        data class M(val id: UUID, val name: String, var amount: BigDecimal)

        val mutable = balances.map { M(it.participantId, it.displayName, it.balance) }.toMutableList()
        val transfers = mutableListOf<Transfer>()

        while (true) {
            val debtor = mutable.minByOrNull { it.amount }
                ?.takeIf { it.amount < threshold.negate() } ?: break
            val creditor = mutable.maxByOrNull { it.amount }
                ?.takeIf { it.amount > threshold } ?: break

            val amount = debtor.amount.abs().min(creditor.amount)
            transfers.add(Transfer(debtor.id, debtor.name, creditor.id, creditor.name, amount))

            debtor.amount = debtor.amount.add(amount)
            creditor.amount = creditor.amount.subtract(amount)
        }

        return transfers
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./gradlew test --tests "com.splitbill.webapp.DebtCalculatorServiceTest"
```
Expected: `4 tests completed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/DebtCalculatorService.kt \
        src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt
git commit -m "feat: add DebtCalculatorService with greedy debt minimization"
```

---

## Task 4: WebAppAuthFilter (TDD)

**Files:**
- Create: `src/main/kotlin/com/splitbill/webapp/WebAppAuthFilter.kt`
- Create: `src/test/kotlin/com/splitbill/webapp/WebAppAuthFilterTest.kt`

- [ ] **Step 1: Write failing tests**

```kotlin
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

            val params = sortedMapOf("auth_date" to authDate, "user" to encodedUser)
            val dataCheckString = params.entries.joinToString("\n") { "${it.key}=${it.value}" }

            val secretKey = hmacSha256("WebAppData".toByteArray(), botToken.toByteArray())
            val hash = hmacSha256(secretKey, dataCheckString.toByteArray()).toHex()

            return params.entries.joinToString("&") { "${it.key}=${it.value}" } + "&hash=$hash"
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
./gradlew test --tests "com.splitbill.webapp.WebAppAuthFilterTest"
```
Expected: FAIL — `WebAppAuthFilter` not found.

- [ ] **Step 3: Implement WebAppAuthFilter**

```kotlin
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./gradlew test --tests "com.splitbill.webapp.WebAppAuthFilterTest"
```
Expected: `4 tests completed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/WebAppAuthFilter.kt \
        src/test/kotlin/com/splitbill/webapp/WebAppAuthFilterTest.kt
git commit -m "feat: add WebAppAuthFilter with Telegram initData HMAC validation"
```

---

## Task 5: Repository additions + SplitSessionService

**Files:**
- Modify: `src/main/kotlin/com/splitbill/split/ClaimRepository.kt`
- Modify: `src/main/kotlin/com/splitbill/session/SplitSessionService.kt`

- [ ] **Step 1: Add new queries to ClaimRepository**

```kotlin
package com.splitbill.split

import org.springframework.data.r2dbc.repository.Modifying
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.r2dbc.repository.R2dbcRepository
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono
import java.util.UUID

interface ClaimRepository : R2dbcRepository<Claim, UUID> {

    fun findByParticipantId(participantId: UUID): Flux<Claim>

    fun findByItemId(itemId: UUID): Flux<Claim>

    @Query("SELECT c.* FROM claims c JOIN receipt_items ri ON c.item_id = ri.id WHERE ri.session_id = :sessionId")
    fun findAllBySessionId(sessionId: UUID): Flux<Claim>

    @Modifying
    @Query("DELETE FROM claims WHERE participant_id = :participantId AND item_id IN (SELECT id FROM receipt_items WHERE session_id = :sessionId)")
    fun deleteByParticipantIdAndSessionId(participantId: UUID, sessionId: UUID): Mono<Long>
}
```

- [ ] **Step 2: Add `createEmptySession` to SplitSessionService**

Add the new method to the existing `SplitSessionService.kt` (keep `createSession` unchanged):

```kotlin
suspend fun createEmptySession(creatorTelegramId: Long, currency: String, chatId: Long): SplitSession {
    val session = SplitSession.create(creatorTelegramId, currency, chatId)
    sessionRepository.save(session).awaitSingle()
    return session
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew compileKotlin
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/splitbill/split/ClaimRepository.kt \
        src/main/kotlin/com/splitbill/session/SplitSessionService.kt
git commit -m "feat: add ClaimRepository session queries and SplitSessionService.createEmptySession"
```

---

## Task 6: DTOs

**Files:**
- Create: `src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt`

- [ ] **Step 1: Create all DTOs in one file**

```kotlin
package com.splitbill.webapp.dto

import java.math.BigDecimal
import java.util.UUID

data class SessionDto(
    val id: UUID,
    val currency: String,
    val status: String,
    val items: List<ItemDto>,
    val myParticipantId: UUID,
    val myClaimedItemIds: List<UUID>
)

data class ItemDto(
    val id: UUID,
    val name: String,
    val price: BigDecimal,
    val quantity: Int,
    val uploadedByParticipantId: UUID?
)

data class AddItemRequest(
    val name: String,
    val price: BigDecimal,
    val quantity: Int = 1
)

data class UpdateClaimsRequest(
    val itemIds: List<UUID>
)

data class ResultsDto(
    val participants: List<ParticipantSummaryDto>,
    val transfers: List<TransferDto>
)

data class ParticipantSummaryDto(
    val id: UUID,
    val displayName: String,
    val totalAmount: BigDecimal
)

data class TransferDto(
    val fromId: UUID,
    val fromName: String,
    val toId: UUID,
    val toName: String,
    val amount: BigDecimal
)
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew compileKotlin
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt
git commit -m "feat: add WebApp DTO classes"
```

---

## Task 7: WebAppController — GET /sessions/{id}

**Files:**
- Create: `src/main/kotlin/com/splitbill/webapp/WebAppController.kt`

- [ ] **Step 1: Create controller with GET session endpoint**

```kotlin
package com.splitbill.webapp

import com.splitbill.participant.Participant
import com.splitbill.participant.ParticipantRepository
import com.splitbill.receipt.ReceiptItemEntity
import com.splitbill.receipt.ReceiptItemRepository
import com.splitbill.receipt.ReceiptParserService
import com.splitbill.session.SplitSessionRepository
import com.splitbill.split.Claim
import com.splitbill.split.ClaimRepository
import com.splitbill.webapp.dto.*
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.codec.multipart.FilePart
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.server.ServerWebExchange
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID

@RestController
@RequestMapping("/api/webapp/sessions")
class WebAppController(
    private val sessionRepository: SplitSessionRepository,
    private val itemRepository: ReceiptItemRepository,
    private val participantRepository: ParticipantRepository,
    private val claimRepository: ClaimRepository,
    private val parserService: ReceiptParserService,
    private val debtCalculator: DebtCalculatorService
) {
    @GetMapping("/{id}")
    suspend fun getSession(@PathVariable id: UUID, exchange: ServerWebExchange): SessionDto {
        val userId = exchange.telegramUserId()
        val session = sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

        val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
            ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

        val items = itemRepository.findBySessionId(id).collectList().awaitSingle()
        val myClaims = claimRepository.findByParticipantId(participant.id).collectList().awaitSingle()

        return SessionDto(
            id = session.id,
            currency = session.currency,
            status = session.status,
            items = items.map { it.toDto() },
            myParticipantId = participant.id,
            myClaimedItemIds = myClaims.map { it.itemId }
        )
    }

    private fun ServerWebExchange.telegramUserId(): Long =
        getAttribute<Long>("telegramUserId")
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED)

    private fun ReceiptItemEntity.toDto() = ItemDto(id, name, price, quantity, uploadedBy)
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew compileKotlin
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/WebAppController.kt
git commit -m "feat: add WebAppController with GET /sessions/{id} endpoint"
```

---

## Task 8: WebAppController — POST items endpoints

**Files:**
- Modify: `src/main/kotlin/com/splitbill/webapp/WebAppController.kt`

- [ ] **Step 1: Add POST /sessions/{id}/items (manual add)**

Add to `WebAppController` class body:

```kotlin
@PostMapping("/{id}/items")
suspend fun addItem(
    @PathVariable id: UUID,
    @RequestBody request: AddItemRequest,
    exchange: ServerWebExchange
): ItemDto {
    val userId = exchange.telegramUserId()
    val session = sessionRepository.findById(id).awaitSingleOrNull()
        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

    val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
        ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

    val entity = ReceiptItemEntity(
        id = UUID.randomUUID(),
        sessionId = session.id,
        name = request.name,
        price = request.price,
        quantity = request.quantity,
        uploadedBy = participant.id
    )
    return itemRepository.save(entity).awaitSingle().toDto()
}
```

- [ ] **Step 2: Add POST /sessions/{id}/photo (receipt upload)**

Add to `WebAppController` class body:

```kotlin
@PostMapping("/{id}/photo", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
suspend fun uploadPhoto(
    @PathVariable id: UUID,
    @RequestPart("file") filePart: FilePart,
    exchange: ServerWebExchange
): List<ItemDto> {
    val userId = exchange.telegramUserId()
    val session = sessionRepository.findById(id).awaitSingleOrNull()
        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

    val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
        ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

    val bytes = filePart.content()
        .map { buf ->
            val bytes = ByteArray(buf.readableByteCount())
            buf.read(bytes)
            bytes
        }
        .reduce { a, b -> a + b }
        .awaitSingle()

    val contentType = filePart.headers().contentType?.toString() ?: "image/jpeg"
    val result = parserService.parse(bytes, contentType)

    if (result.items.isEmpty()) throw ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "No items recognized")

    val entities = result.items.map { item ->
        ReceiptItemEntity(
            id = UUID.randomUUID(),
            sessionId = session.id,
            name = item.name,
            price = item.price,
            quantity = item.quantity,
            uploadedBy = participant.id
        )
    }
    return itemRepository.saveAll(entities).collectList().awaitSingle().map { it.toDto() }
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew compileKotlin
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/WebAppController.kt
git commit -m "feat: add POST /items and POST /photo endpoints to WebAppController"
```

---

## Task 9: WebAppController — claims + results endpoints

**Files:**
- Modify: `src/main/kotlin/com/splitbill/webapp/WebAppController.kt`

- [ ] **Step 1: Add PUT /sessions/{id}/claims**

Add to `WebAppController` class body:

```kotlin
@PutMapping("/{id}/claims")
suspend fun updateClaims(
    @PathVariable id: UUID,
    @RequestBody request: UpdateClaimsRequest,
    exchange: ServerWebExchange
): List<UUID> {
    val userId = exchange.telegramUserId()
    val participant = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Participant not found — open the session first")

    claimRepository.deleteByParticipantIdAndSessionId(participant.id, id).awaitSingleOrNull()

    val newClaims = request.itemIds.map { itemId ->
        Claim(id = UUID.randomUUID(), itemId = itemId, participantId = participant.id)
    }
    if (newClaims.isNotEmpty()) {
        claimRepository.saveAll(newClaims).collectList().awaitSingle()
    }

    return request.itemIds
}
```

- [ ] **Step 2: Add GET /sessions/{id}/results**

Add to `WebAppController` class body:

```kotlin
@GetMapping("/{id}/results")
suspend fun getResults(@PathVariable id: UUID, exchange: ServerWebExchange): ResultsDto {
    exchange.telegramUserId() // auth check only

    val participants = participantRepository.findBySessionId(id).collectList().awaitSingle()
    val items = itemRepository.findBySessionId(id).collectList().awaitSingle()
    val allClaims = claimRepository.findAllBySessionId(id).collectList().awaitSingle()

    val claimsByItem: Map<UUID, List<Claim>> = allClaims.groupBy { it.itemId }
    val claimsByParticipant: Map<UUID, List<Claim>> = allClaims.groupBy { it.participantId }

    val summaries = participants.map { p ->
        val totalAmount = (claimsByParticipant[p.id] ?: emptyList())
            .mapNotNull { claim -> items.find { it.id == claim.itemId } }
            .sumOf { item ->
                val claimCount = (claimsByItem[item.id]?.size ?: 1).coerceAtLeast(1)
                item.price.multiply(BigDecimal(item.quantity))
                    .divide(BigDecimal(claimCount), 2, RoundingMode.HALF_UP)
            }
        ParticipantSummaryDto(
            id = p.id,
            displayName = p.guestName ?: "User ${p.telegramId}",
            totalAmount = totalAmount
        )
    }

    // Debt transfers: only from items with uploadedBy (known payer)
    val balances = participants.map { p ->
        val paid = items.filter { it.uploadedBy == p.id }
            .sumOf { it.price.multiply(BigDecimal(it.quantity)) }

        val owedFromPaidItems = (claimsByParticipant[p.id] ?: emptyList())
            .mapNotNull { claim -> items.find { it.id == claim.itemId && it.uploadedBy != null } }
            .sumOf { item ->
                val claimCount = (claimsByItem[item.id]?.size ?: 1).coerceAtLeast(1)
                item.price.multiply(BigDecimal(item.quantity))
                    .divide(BigDecimal(claimCount), 2, RoundingMode.HALF_UP)
            }

        ParticipantBalance(
            participantId = p.id,
            displayName = p.guestName ?: "User ${p.telegramId}",
            balance = paid.subtract(owedFromPaidItems)
        )
    }

    val transfers = debtCalculator.calculate(balances).map { t ->
        TransferDto(t.fromId, t.fromName, t.toId, t.toName, t.amount)
    }

    return ResultsDto(participants = summaries, transfers = transfers)
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew compileKotlin
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Run all tests**

```bash
./gradlew test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/WebAppController.kt
git commit -m "feat: add PUT /claims and GET /results endpoints to WebAppController"
```

---

## Task 10: BotProperties + NewSplitCommand

**Files:**
- Modify: `src/main/kotlin/com/splitbill/config/BotProperties.kt`
- Modify: `src/main/resources/application.yml`
- Modify: `src/main/resources/application-local.yml`
- Modify: `src/main/resources/application-test.yml`
- Modify: `src/main/kotlin/com/splitbill/bot/command/NewSplitCommand.kt`

- [ ] **Step 1: Add webappUrl to BotProperties**

```kotlin
package com.splitbill.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "telegram.bot")
data class BotProperties(
    val token: String,
    val username: String,
    val webhookUrl: String = "",
    val webappUrl: String = ""
)
```

- [ ] **Step 2: Add webapp-url to application.yml**

In `application.yml`, under `telegram.bot:`, add:
```yaml
    webapp-url: ${TELEGRAM_WEBAPP_URL:}
```

The full `telegram.bot` block should look like:
```yaml
telegram:
  bot:
    token: ${TELEGRAM_BOT_TOKEN}
    username: ${TELEGRAM_BOT_USERNAME}
    webhook-url: ${TELEGRAM_WEBHOOK_URL:}
    webapp-url: ${TELEGRAM_WEBAPP_URL:}
```

- [ ] **Step 3: Add stubs to application-local.yml and application-test.yml**

In `application-local.yml`, add under `telegram.bot`:
```yaml
    webapp-url: ${TELEGRAM_WEBAPP_URL:http://localhost:8080}
```

In `application-test.yml`, add under `telegram.bot`:
```yaml
    webapp-url: http://localhost:8080
```

- [ ] **Step 4: Update NewSplitCommand for group chats and WebApp button**

```kotlin
package com.splitbill.bot.command

import com.splitbill.config.BotProperties
import com.splitbill.session.SplitSessionService
import kotlinx.coroutines.runBlocking
import org.springframework.stereotype.Component
import org.telegram.telegrambots.meta.api.methods.send.SendMessage
import org.telegram.telegrambots.meta.api.objects.Update
import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton
import org.telegram.telegrambots.meta.api.objects.webapp.WebAppInfo
import org.telegram.telegrambots.meta.generics.TelegramClient

@Component
class NewSplitCommand(
    private val telegramClient: TelegramClient,
    private val sessionService: SplitSessionService,
    private val botProperties: BotProperties
) {
    fun handle(update: Update) {
        val chatId = update.message.chatId
        val creatorId = update.message.from.id

        val session = runBlocking {
            sessionService.createEmptySession(
                creatorTelegramId = creatorId,
                currency = "RUB",
                chatId = chatId
            )
        }

        val webappUrl = "${botProperties.webappUrl}/webapp/?session=${session.id}"

        val button = InlineKeyboardButton.builder()
            .text("Открыть приложение")
            .webApp(WebAppInfo(webappUrl))
            .build()

        val message = SendMessage.builder()
            .chatId(chatId.toString())
            .text("Сессия создана! Добавляйте чеки и отмечайте свои позиции.")
            .replyMarkup(InlineKeyboardMarkup(listOf(listOf(button))))
            .build()

        telegramClient.execute(message)
    }
}
```

- [ ] **Step 5: Verify compilation and tests**

```bash
./gradlew compileKotlin && ./gradlew test
```
Expected: `BUILD SUCCESSFUL`, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/splitbill/config/BotProperties.kt \
        src/main/kotlin/com/splitbill/bot/command/NewSplitCommand.kt \
        src/main/resources/application.yml \
        src/main/resources/application-local.yml \
        src/main/resources/application-test.yml
git commit -m "feat: update NewSplitCommand for group chat with WebApp button"
```

---

## Task 11: Frontend project setup

**Files:**
- Create: `webapp/package.json`
- Create: `webapp/vite.config.ts`
- Create: `webapp/tsconfig.json`
- Create: `webapp/index.html`

- [ ] **Step 1: Create webapp/package.json**

```json
{
  "name": "splitbill-webapp",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 2: Create webapp/vite.config.ts**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/webapp/',
  build: {
    outDir: '../src/main/resources/static/webapp',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 3: Create webapp/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create webapp/index.html**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>SplitBill</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: var(--tg-theme-bg-color, #fff); color: var(--tg-theme-text-color, #000); }
    #app { max-width: 480px; margin: 0 auto; padding: 16px; }
    button { cursor: pointer; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Install dependencies**

```bash
cd webapp && npm install
```
Expected: `node_modules` created, no errors.

- [ ] **Step 6: Verify build succeeds with empty main.ts**

```bash
mkdir -p webapp/src && echo "export {}" > webapp/src/main.ts
cd webapp && npm run build
```
Expected: `dist/` (temporary) or `src/main/resources/static/webapp/` created. Files: `index.html`, `assets/`.

Delete the temporary src/main.ts:
```bash
rm webapp/src/main.ts
```

- [ ] **Step 7: Commit**

```bash
git add webapp/
git commit -m "feat: add Vite + TypeScript frontend project scaffold"
```

---

## Task 12: Frontend types.ts + api.ts

**Files:**
- Create: `webapp/src/types.ts`
- Create: `webapp/src/api.ts`

- [ ] **Step 1: Create webapp/src/types.ts**

```typescript
export interface ItemDto {
  id: string
  name: string
  price: number
  quantity: number
  uploadedByParticipantId: string | null
}

export interface SessionDto {
  id: string
  currency: string
  status: string
  items: ItemDto[]
  myParticipantId: string
  myClaimedItemIds: string[]
}

export interface ParticipantSummaryDto {
  id: string
  displayName: string
  totalAmount: number
}

export interface TransferDto {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

export interface ResultsDto {
  participants: ParticipantSummaryDto[]
  transfers: TransferDto[]
}
```

- [ ] **Step 2: Create webapp/src/api.ts**

```typescript
import type { SessionDto, ItemDto, ResultsDto } from './types'

const BASE = '/api/webapp/sessions'

function initData(): string {
  return window.Telegram?.WebApp?.initData ?? ''
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initData(),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function getSession(sessionId: string): Promise<SessionDto> {
  const res = await fetch(`${BASE}/${sessionId}`, { headers: headers() })
  return handleResponse<SessionDto>(res)
}

export async function addItem(sessionId: string, name: string, price: number, quantity: number): Promise<ItemDto> {
  const res = await fetch(`${BASE}/${sessionId}/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, price, quantity }),
  })
  return handleResponse<ItemDto>(res)
}

export async function uploadPhoto(sessionId: string, file: File): Promise<ItemDto[]> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/${sessionId}/photo`, {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': initData() },
    body: form,
  })
  return handleResponse<ItemDto[]>(res)
}

export async function updateClaims(sessionId: string, itemIds: string[]): Promise<string[]> {
  const res = await fetch(`${BASE}/${sessionId}/claims`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ itemIds }),
  })
  return handleResponse<string[]>(res)
}

export async function getResults(sessionId: string): Promise<ResultsDto> {
  const res = await fetch(`${BASE}/${sessionId}/results`, { headers: headers() })
  return handleResponse<ResultsDto>(res)
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd webapp && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/types.ts webapp/src/api.ts
git commit -m "feat: add frontend TypeScript types and API client"
```

---

## Task 13: Session screen + AddItemModal

**Files:**
- Create: `webapp/src/components/addItemModal.ts`
- Create: `webapp/src/screens/session.ts`

- [ ] **Step 1: Create webapp/src/components/addItemModal.ts**

```typescript
export function createAddItemModal(onSubmit: (name: string, price: number, quantity: number) => void): HTMLElement {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;z-index:100'

  const sheet = document.createElement('div')
  sheet.style.cssText = 'background:var(--tg-theme-bg-color,#fff);width:100%;padding:20px;border-radius:16px 16px 0 0'

  sheet.innerHTML = `
    <h3 style="margin-bottom:16px">Добавить позицию</h3>
    <input id="item-name" type="text" placeholder="Название" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-price" type="number" step="0.01" min="0.01" placeholder="Цена" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-qty" type="number" min="1" value="1" placeholder="Количество" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <div style="display:flex;gap:8px">
      <button id="modal-cancel" style="flex:1;padding:12px;border:none;border-radius:8px;background:#eee;font-size:16px">Отмена</button>
      <button id="modal-submit" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:16px">Добавить</button>
    </div>
  `

  overlay.appendChild(sheet)

  overlay.querySelector('#modal-cancel')!.addEventListener('click', () => overlay.remove())
  overlay.querySelector('#modal-submit')!.addEventListener('click', () => {
    const name = (overlay.querySelector('#item-name') as HTMLInputElement).value.trim()
    const price = parseFloat((overlay.querySelector('#item-price') as HTMLInputElement).value)
    const quantity = parseInt((overlay.querySelector('#item-qty') as HTMLInputElement).value)
    if (!name || isNaN(price) || price <= 0 || isNaN(quantity) || quantity < 1) {
      alert('Заполните все поля корректно')
      return
    }
    overlay.remove()
    onSubmit(name, price, quantity)
  })

  return overlay
}
```

- [ ] **Step 2: Create webapp/src/screens/session.ts**

```typescript
import type { SessionDto, ItemDto } from '../types'
import { getSession, addItem, uploadPhoto, updateClaims } from '../api'
import { createAddItemModal } from '../components/addItemModal'

export async function renderSession(container: HTMLElement, sessionId: string, onResults: () => void) {
  container.innerHTML = '<p style="padding:16px">Загрузка...</p>'

  let session: SessionDto
  try {
    session = await getSession(sessionId)
  } catch (e) {
    container.innerHTML = `<p style="padding:16px;color:red">Ошибка загрузки сессии: ${(e as Error).message}</p>`
    return
  }

  const claimedIds = new Set<string>(session.myClaimedItemIds)

  function formatPrice(item: ItemDto): string {
    const total = item.price * item.quantity
    return item.quantity > 1
      ? `${item.quantity} × ${item.price} = ${total} ${session.currency}`
      : `${item.price} ${session.currency}`
  }

  function myTotal(): number {
    return session.items
      .filter(i => claimedIds.has(i.id))
      .reduce((sum, i) => sum + i.price * i.quantity, 0)
  }

  function render() {
    container.innerHTML = `
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:16px">${session.currency} · ${session.status}</p>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <label style="flex:1">
            <button id="btn-photo" style="width:100%;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">📷 Загрузить чек</button>
            <input id="photo-input" type="file" accept="image/*" style="display:none" />
          </label>
          <button id="btn-add" style="flex:1;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">+ Позиция</button>
        </div>
        <div id="items-list"></div>
        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--tg-theme-bg-color,#fff);border-top:1px solid #eee;max-width:480px;margin:0 auto">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>Мои позиции: <b>${myTotal().toFixed(2)} ${session.currency}</b></span>
            <button id="btn-results" style="padding:10px 16px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:14px">Итоги →</button>
          </div>
        </div>
      </div>
    `

    const list = container.querySelector('#items-list')!
    session.items.forEach(item => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0'
      const checked = claimedIds.has(item.id)
      row.innerHTML = `
        <input type="checkbox" id="item-${item.id}" ${checked ? 'checked' : ''} style="width:20px;height:20px;margin-right:12px;flex-shrink:0" />
        <label for="item-${item.id}" style="flex:1;cursor:pointer">
          <div style="font-size:15px">${item.name}</div>
          <div style="font-size:13px;color:#888">${formatPrice(item)}</div>
        </label>
      `
      const checkbox = row.querySelector('input')!
      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) claimedIds.add(item.id)
        else claimedIds.delete(item.id)
        container.querySelector<HTMLElement>('b')!.textContent = `${myTotal().toFixed(2)} ${session.currency}`
        try {
          await updateClaims(sessionId, Array.from(claimedIds))
        } catch (e) {
          checkbox.checked = !checkbox.checked
          if (checkbox.checked) claimedIds.add(item.id) else claimedIds.delete(item.id)
        }
      })
      list.appendChild(row)
    })

    container.querySelector('#btn-photo')!.addEventListener('click', () => {
      container.querySelector<HTMLInputElement>('#photo-input')!.click()
    })

    container.querySelector('#photo-input')!.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const btn = container.querySelector<HTMLButtonElement>('#btn-photo')!
      btn.textContent = '⏳ Распознаю...'
      btn.disabled = true
      try {
        const newItems = await uploadPhoto(sessionId, file)
        session.items.push(...newItems)
        render()
      } catch (err) {
        alert(`Ошибка: ${(err as Error).message}`)
        btn.textContent = '📷 Загрузить чек'
        btn.disabled = false
      }
    })

    container.querySelector('#btn-add')!.addEventListener('click', () => {
      const modal = createAddItemModal(async (name, price, quantity) => {
        try {
          const newItem = await addItem(sessionId, name, price, quantity)
          session.items.push(newItem)
          render()
        } catch (err) {
          alert(`Ошибка: ${(err as Error).message}`)
        }
      })
      document.body.appendChild(modal)
    })

    container.querySelector('#btn-results')!.addEventListener('click', onResults)
  }

  render()
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd webapp && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/addItemModal.ts webapp/src/screens/session.ts
git commit -m "feat: add session screen and addItemModal component"
```

---

## Task 14: Results screen + main.ts

**Files:**
- Create: `webapp/src/screens/results.ts`
- Create: `webapp/src/main.ts`

- [ ] **Step 1: Create webapp/src/screens/results.ts**

```typescript
import type { ResultsDto } from '../types'
import { getResults } from '../api'

export async function renderResults(container: HTMLElement, sessionId: string, onBack: () => void) {
  container.innerHTML = '<p style="padding:16px">Считаю...</p>'

  let results: ResultsDto
  try {
    results = await getResults(sessionId)
  } catch (e) {
    container.innerHTML = `<p style="padding:16px;color:red">Ошибка: ${(e as Error).message}</p>`
    return
  }

  const rows = results.participants.map(p =>
    `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
       <span>${p.displayName}</span>
       <b>${p.totalAmount.toFixed(2)}</b>
     </div>`
  ).join('')

  const transfers = results.transfers.length
    ? results.transfers.map(t =>
        `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">
           ${t.fromName} → ${t.toName}: <b>${t.amount.toFixed(2)}</b>
         </div>`
      ).join('')
    : '<p style="color:#888;padding:8px 0">Все в расчёте 🎉</p>'

  container.innerHTML = `
    <div>
      <div style="display:flex;align-items:center;margin-bottom:16px">
        <button id="btn-back" style="border:none;background:none;font-size:22px;padding:0 8px 0 0;cursor:pointer">←</button>
        <h2>Итоги</h2>
      </div>
      <section style="margin-bottom:24px">
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Суммы участников</h3>
        ${rows}
      </section>
      <section>
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Переводы</h3>
        ${transfers}
      </section>
    </div>
  `

  container.querySelector('#btn-back')!.addEventListener('click', onBack)
}
```

- [ ] **Step 2: Create webapp/src/main.ts**

```typescript
import { renderSession } from './screens/session'
import { renderResults } from './screens/results'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        ready(): void
        expand(): void
      }
    }
  }
}

function getSessionId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('session')
}

async function main() {
  window.Telegram?.WebApp?.ready()
  window.Telegram?.WebApp?.expand()

  const app = document.getElementById('app')!
  const sessionId = getSessionId()

  if (!sessionId) {
    app.innerHTML = '<p style="padding:16px;color:red">Нет ID сессии. Открой приложение через бота.</p>'
    return
  }

  await renderSession(app, sessionId, () => {
    renderResults(app, sessionId, () => {
      renderSession(app, sessionId, () => {
        renderResults(app, sessionId, () => {})
      })
    })
  })
}

main().catch(err => {
  document.getElementById('app')!.innerHTML =
    `<p style="padding:16px;color:red">Ошибка: ${err.message}</p>`
})
```

- [ ] **Step 3: Build the frontend**

```bash
cd webapp && npm run build
```
Expected: files appear in `src/main/resources/static/webapp/`.

Verify:
```bash
ls src/main/resources/static/webapp/
```
Expected: `index.html` and `assets/` directory.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/screens/results.ts webapp/src/main.ts \
        src/main/resources/static/webapp/
git commit -m "feat: add results screen and main app entry point, include built webapp"
```

---

## Task 15: Gradle npmBuild integration

**Files:**
- Modify: `build.gradle.kts`

- [ ] **Step 1: Add npmBuild task and bootJar dependency**

In `build.gradle.kts`, add at the end (before the last closing brace if any, or at the bottom of the file):

```kotlin
val npmBuild by tasks.registering(Exec::class) {
    workingDir("webapp")
    commandLine("npm", "run", "build")
    inputs.dir("webapp/src")
    inputs.file("webapp/package.json")
    inputs.file("webapp/vite.config.ts")
    outputs.dir("src/main/resources/static/webapp")
}

tasks.named("bootJar") {
    dependsOn(npmBuild)
}

tasks.named("processResources") {
    dependsOn(npmBuild)
}
```

- [ ] **Step 2: Verify clean build includes frontend**

```bash
./gradlew clean bootJar
```
Expected: `BUILD SUCCESSFUL`. Check:
```bash
jar tf build/libs/splitbill-*.jar | grep webapp
```
Expected: lines like `BOOT-INF/classes/static/webapp/index.html`

- [ ] **Step 3: Run full test suite**

```bash
./gradlew test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add build.gradle.kts
git commit -m "feat: add Gradle npmBuild task, bootJar includes frontend"
```

---

## Done

All 15 tasks complete → single JAR serves the Telegram Mini App at `/webapp/` and REST API at `/api/webapp/*`.

**Manual smoke test after deployment:**
1. Add bot to a group chat
2. Send `/newsplit` — verify bot sends message with "Открыть приложение" button
3. Tap button → verify Mini App opens showing the session
4. Upload a receipt photo → verify items appear
5. Add item manually → verify it appears
6. Check some items → verify checkboxes save
7. Tap "Итоги" → verify per-person totals and transfers
