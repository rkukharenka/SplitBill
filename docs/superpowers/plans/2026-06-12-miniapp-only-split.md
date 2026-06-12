# Miniapp-Only Bill Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all bill interaction into the Telegram miniapp — chat only creates sessions — with BYN currency and per-position assignment of payer + sharers (incl. guests) so results show who owes whom.

**Architecture:** Spring WebFlux + R2DBC Postgres backend; vanilla-TS Vite miniapp. No DB migration (reuse `participants.guest_name` for guests, `receipt_items.uploaded_by` as payer, `claims` as sharers). Claims become shared session state editable by anyone via a per-item assignment endpoint.

**Tech Stack:** Kotlin, Spring Boot WebFlux, Spring Data R2DBC, JUnit5 + Testcontainers, TypeScript/Vite.

**Note on integration tests:** local Docker is unavailable; testcontainers tests run in CI. To run them locally, tunnel prod Docker — see `docs/superpowers/specs/2026-06-12-miniapp-only-split-design.md` history. Unit tests (no Docker) run normally with `./gradlew test --tests <Class>`.

---

## File Structure

Backend:
- `src/main/kotlin/com/splitbill/bot/SplitBillBot.kt` — drop photo branch + dep (modify)
- `src/main/kotlin/com/splitbill/bot/handler/PhotoHandler.kt` — delete
- `src/main/kotlin/com/splitbill/bot/command/NewSplitCommand.kt` — BYN + text (modify)
- `src/main/kotlin/com/splitbill/bot/command/StartCommand.kt` / `HelpCommand.kt` — text (modify)
- `src/main/kotlin/com/splitbill/session/SplitSession.kt` — currency default BYN (modify)
- `src/main/kotlin/com/splitbill/receipt/ReceiptParserService.kt` — BYN defaults (modify)
- `src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt` — DTO changes (modify)
- `src/main/kotlin/com/splitbill/split/ClaimRepository.kt` — add `deleteByItemId` (modify)
- `src/main/kotlin/com/splitbill/webapp/WebAppController.kt` — new endpoints, richer GET (modify)

Tests:
- `src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt` — guest-payer / multi-sharer (modify)
- `src/test/kotlin/com/splitbill/webapp/WebAppControllerIntegrationTest.kt` — roster + assignment (modify)
- `src/test/kotlin/com/splitbill/receipt/ReceiptResultDefaultTest.kt` — BYN default (create)

Frontend:
- `webapp/src/types.ts` — DTO types (modify)
- `webapp/src/api.ts` — replace `updateClaims`, add `setItemAssignment`, `addParticipant` (modify)
- `webapp/src/screens/session.ts` — roster + per-item payer/sharers (modify)

---

## Task 1: BYN defaults in domain + parser

**Files:**
- Modify: `src/main/kotlin/com/splitbill/session/SplitSession.kt:17`
- Modify: `src/main/kotlin/com/splitbill/receipt/ReceiptParserService.kt` (prompt + 2 fallbacks)
- Create: `src/test/kotlin/com/splitbill/receipt/ReceiptResultDefaultTest.kt`

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/splitbill/receipt/ReceiptResultDefaultTest.kt`:

```kotlin
package com.splitbill.receipt

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ReceiptResultDefaultTest {
    @Test
    fun `default currency is BYN`() {
        assertEquals("BYN", ReceiptResult(items = emptyList()).currency)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.splitbill.receipt.ReceiptResultDefaultTest"`
Expected: FAIL — `expected: <BYN> but was: <RUB>`

- [ ] **Step 3: Make the changes**

In `src/main/kotlin/com/splitbill/receipt/ReceiptParserService.kt`:
- In `SYSTEM_PROMPT`, change the example JSON `"currency":"RUB"` → `"currency":"BYN"` and the no-recognition fallback `{"items":[],"currency":"RUB","confidence":0.0}` → `"currency":"BYN"`.
- Change `ReceiptResult` data class default `val currency: String = "RUB"` → `"BYN"`.
- In `parseJson` catch block, `ReceiptResult(items = emptyList(), currency = "RUB", confidence = 0.0)` → `currency = "BYN"`.
- In private `ReceiptResultDto`, `val currency: String = "RUB"` → `"BYN"`.

In `src/main/kotlin/com/splitbill/session/SplitSession.kt:17`, change `val status` line area: `val currency: String = "RUB",` → `val currency: String = "BYN",`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.splitbill.receipt.ReceiptResultDefaultTest"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/splitbill/session/SplitSession.kt src/main/kotlin/com/splitbill/receipt/ReceiptParserService.kt src/test/kotlin/com/splitbill/receipt/ReceiptResultDefaultTest.kt
git commit -m "feat: default currency BYN in domain and parser"
```

---

## Task 2: Strip receipt handling from chat; BYN + miniapp-only messages

**Files:**
- Delete: `src/main/kotlin/com/splitbill/bot/handler/PhotoHandler.kt`
- Modify: `src/main/kotlin/com/splitbill/bot/SplitBillBot.kt`
- Modify: `src/main/kotlin/com/splitbill/bot/command/NewSplitCommand.kt:28,42`
- Modify: `src/main/kotlin/com/splitbill/bot/command/StartCommand.kt`
- Modify: `src/main/kotlin/com/splitbill/bot/command/HelpCommand.kt`

No unit test (Telegram client side effects); verification is compile + existing suite.

- [ ] **Step 1: Delete PhotoHandler**

```bash
git rm src/main/kotlin/com/splitbill/bot/handler/PhotoHandler.kt
```

- [ ] **Step 2: Update SplitBillBot — remove photo dependency and branch**

Replace the whole class body of `src/main/kotlin/com/splitbill/bot/SplitBillBot.kt` with:

```kotlin
package com.splitbill.bot

import com.splitbill.bot.command.HelpCommand
import com.splitbill.bot.command.NewSplitCommand
import com.splitbill.bot.command.StartCommand
import org.springframework.stereotype.Component
import org.telegram.telegrambots.longpolling.util.LongPollingSingleThreadUpdateConsumer
import org.telegram.telegrambots.meta.api.objects.Update

// LongPollingSingleThreadUpdateConsumer: consume(List<Update>) dispatches to consume(Update) automatically
@Component
class SplitBillBot(
    private val startCommand: StartCommand,
    private val newSplitCommand: NewSplitCommand,
    private val helpCommand: HelpCommand
) : LongPollingSingleThreadUpdateConsumer {

    override fun consume(update: Update) {
        if (update.hasMessage() && update.message.hasText()) handleText(update)
    }

    private fun handleText(update: Update) {
        // startsWith handles "/start@botname" form Telegram sends in group chats
        val text = update.message.text.trim()
        when {
            text.startsWith("/start") -> startCommand.handle(update)
            text.startsWith("/newsplit") -> newSplitCommand.handle(update)
            text.startsWith("/help") -> helpCommand.handle(update)
        }
    }
}
```

- [ ] **Step 3: Update NewSplitCommand — BYN + new message text**

In `src/main/kotlin/com/splitbill/bot/command/NewSplitCommand.kt`:
- Line ~28: `currency = "RUB",` → `currency = "BYN",`
- Line ~42: `.text("Сессия создана! Добавляйте чеки и отмечайте свои позиции.")` →
  `.text("Сессия создана! Откройте приложение, чтобы добавить позиции и разделить счёт.")`

- [ ] **Step 4: Update StartCommand and HelpCommand text (no chat receipts)**

In `src/main/kotlin/com/splitbill/bot/command/StartCommand.kt`, replace the `.text(...)` block content with:

```kotlin
                """
                Привет! Я помогу разделить счёт.

                Как это работает:
                • /newsplit создаёт сессию и кнопку «Открыть приложение»
                • В приложении добавляете позиции (фото чека или вручную)
                • Отмечаете кто платил и между кем делится каждая позиция
                • Итоги показывают, кто кому сколько должен

                /newsplit — начать новое разделение
                /help — подробная инструкция
                """.trimIndent()
```

In `src/main/kotlin/com/splitbill/bot/command/HelpCommand.kt`, replace the `.text(...)` block content with:

```kotlin
                """
                Как пользоваться SplitBill:

                1. /newsplit — создать разделение (работает в группе и в личке)
                2. Нажми «Открыть приложение»
                3. Добавь позиции: загрузи фото чека или введи вручную
                4. Для каждой позиции выбери, кто платил и кто делит
                5. Гостей без Telegram добавляй по имени кнопкой «+ Гость»
                6. Открой «Итоги» — увидишь, кто кому сколько должен

                Ограничения:
                • Сессия хранится 48 часов, потом удаляется
                """.trimIndent()
```

- [ ] **Step 5: Compile**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL (no reference to PhotoHandler remains)

- [ ] **Step 6: Commit**

```bash
git add -A src/main/kotlin/com/splitbill/bot
git commit -m "feat: chat creates sessions only; remove receipt handling from chat"
```

---

## Task 3: Backend DTOs — full roster + per-item payer/sharers

**Files:**
- Modify: `src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt`

- [ ] **Step 1: Rewrite the session-facing DTOs**

In `src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt`, replace the `SessionDto`, `ItemDto`, and `UpdateClaimsRequest` declarations with the following (leave `AddItemRequest`, `ResultsDto`, `ParticipantSummaryDto`, `TransferDto` unchanged):

```kotlin
data class SessionDto(
    val id: UUID,
    val currency: String,
    val status: String,
    val participants: List<ParticipantDto>,
    val items: List<ItemDto>,
    val myParticipantId: UUID
)

data class ParticipantDto(
    val id: UUID,
    val displayName: String,
    val isGuest: Boolean
)

data class ItemDto(
    val id: UUID,
    val name: String,
    val price: BigDecimal,
    val quantity: Int,
    val payerId: UUID?,
    val sharerIds: List<UUID>
)

data class AddParticipantRequest(
    val name: String
)

data class ItemAssignmentRequest(
    val payerId: UUID,
    val sharerIds: List<UUID>
)
```

Delete the old `UpdateClaimsRequest` data class (the `claims` endpoint is removed in Task 5).

- [ ] **Step 2: Compile (will fail in controller — expected, fixed in Task 5)**

Run: `./gradlew compileKotlin`
Expected: FAIL — `WebAppController.kt` references removed `myClaimedItemIds`, `UpdateClaimsRequest`, old `ItemDto` shape. This is expected; Task 5 fixes it. Do not commit yet.

---

## Task 4: ClaimRepository — deleteByItemId

**Files:**
- Modify: `src/main/kotlin/com/splitbill/split/ClaimRepository.kt`

- [ ] **Step 1: Add the delete method**

In `src/main/kotlin/com/splitbill/split/ClaimRepository.kt`, add inside the interface (after `findAllBySessionId`):

```kotlin
    @Modifying
    @Query("DELETE FROM claims WHERE item_id = :itemId")
    fun deleteByItemId(itemId: UUID): Mono<Long>
```

(`@Modifying`, `@Query`, `Mono`, `UUID` are already imported.)

- [ ] **Step 2: Compile**

Run: `./gradlew compileKotlin`
Expected: still FAIL in `WebAppController.kt` (Task 5). The interface change itself compiles.

---

## Task 5: WebAppController — richer GET, add-guest, per-item assignment

**Files:**
- Modify: `src/main/kotlin/com/splitbill/webapp/WebAppController.kt`

- [ ] **Step 1: Update imports + getSession**

In `src/main/kotlin/com/splitbill/webapp/WebAppController.kt`, ensure `import com.splitbill.webapp.dto.*` stays. Replace the `getSession` method with:

```kotlin
    @GetMapping("/{id}")
    suspend fun getSession(@PathVariable id: UUID, exchange: ServerWebExchange): SessionDto {
        val userId = exchange.telegramUserId()
        val session = sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)

        // auto-create caller's participant BEFORE listing the roster so they appear in it
        val me = participantRepository.findBySessionIdAndTelegramId(id, userId).awaitSingleOrNull()
            ?: participantRepository.save(Participant.telegram(id, userId)).awaitSingle()

        val participants = participantRepository.findBySessionId(id).collectList().awaitSingle()
        val items = itemRepository.findBySessionId(id).collectList().awaitSingle()
        val claims = claimRepository.findAllBySessionId(id).collectList().awaitSingle()
        val sharersByItem: Map<UUID, List<UUID>> =
            claims.groupBy({ it.itemId }, { it.participantId })

        return SessionDto(
            id = session.id,
            currency = session.currency,
            status = session.status,
            participants = participants.map { it.toDto() },
            items = items.map { it.toDto(sharersByItem[it.id] ?: emptyList()) },
            myParticipantId = me.id
        )
    }
```

- [ ] **Step 2: Update addItem and uploadPhoto return mapping**

In `addItem`, the final line `return itemRepository.save(entity).awaitSingle().toDto()` →
`return itemRepository.save(entity).awaitSingle().toDto(emptyList())`.

In `uploadPhoto`, the final line `...collectList().awaitSingle().map { it.toDto() }` →
`...collectList().awaitSingle().map { it.toDto(emptyList()) }`.

- [ ] **Step 3: Replace the updateClaims endpoint with add-guest + assignment**

Delete the entire `@PutMapping("/{id}/claims") suspend fun updateClaims(...)` method. In its place add:

```kotlin
    @PostMapping("/{id}/participants")
    suspend fun addParticipant(
        @PathVariable id: UUID,
        @RequestBody request: AddParticipantRequest,
        exchange: ServerWebExchange
    ): ParticipantDto {
        exchange.telegramUserId() // auth check
        val name = request.name.trim()
        if (name.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name required")
        sessionRepository.findById(id).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
        return participantRepository.save(Participant.guest(id, name)).awaitSingle().toDto()
    }

    @PutMapping("/{id}/items/{itemId}/assignment")
    suspend fun setAssignment(
        @PathVariable id: UUID,
        @PathVariable itemId: UUID,
        @RequestBody request: ItemAssignmentRequest,
        exchange: ServerWebExchange
    ): ItemDto {
        exchange.telegramUserId() // auth check
        val item = itemRepository.findById(itemId).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
        if (item.sessionId != id) throw ResponseStatusException(HttpStatus.NOT_FOUND)

        val rosterIds = participantRepository.findBySessionId(id).collectList().awaitSingle()
            .map { it.id }.toSet()
        if (request.payerId !in rosterIds)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "payer not in session")
        val sharerIds = request.sharerIds.distinct()
        if (!rosterIds.containsAll(sharerIds))
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "sharer not in session")

        val updated = item.copy(uploadedBy = request.payerId)
        itemRepository.save(updated).awaitSingle()

        claimRepository.deleteByItemId(itemId).awaitSingleOrNull()
        if (sharerIds.isNotEmpty()) {
            claimRepository.saveAll(sharerIds.map { Claim.create(itemId, it) })
                .collectList().awaitSingle()
        }
        return updated.toDto(sharerIds)
    }
```

- [ ] **Step 4: Update the private mappers at the bottom of the class**

Replace `private fun ReceiptItemEntity.toDto() = ItemDto(id, name, price, quantity, uploadedBy)` with:

```kotlin
    private fun ReceiptItemEntity.toDto(sharerIds: List<UUID>) =
        ItemDto(id, name, price, quantity, uploadedBy, sharerIds)

    private fun Participant.toDto() =
        ParticipantDto(id, guestName ?: "User $telegramId", guestName != null)
```

Confirm imports include `com.splitbill.split.Claim` (already present) and `com.splitbill.participant.Participant` (already present).

- [ ] **Step 5: Compile**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Run existing non-Docker unit tests**

Run: `./gradlew test --tests "com.splitbill.webapp.WebAppAuthFilterTest" --tests "com.splitbill.webapp.DebtCalculatorServiceTest" --tests "com.splitbill.receipt.ReceiptResultDefaultTest"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/kotlin/com/splitbill/webapp/dto/WebAppDto.kt src/main/kotlin/com/splitbill/split/ClaimRepository.kt src/main/kotlin/com/splitbill/webapp/WebAppController.kt
git commit -m "feat: webapp roster, add-guest and per-position payer/sharer assignment"
```

---

## Task 6: Debt calculation tests — guest payer + multi-sharer

**Files:**
- Modify: `src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt`

The algorithm is unchanged; these tests lock in the split semantics at the balance level (payer credited full item, sharers debited equal shares).

- [ ] **Step 1: Add tests**

Append inside the class in `src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt`:

```kotlin
    @Test
    fun `guest payer becomes creditor`() {
        // Guest paid 60 for an item shared by guest + two users (20 each).
        // balances: guest = 60 - 20 = +40 ; userA = -20 ; userB = -20
        val guest = balance("Guest", 40.0)
        val a = balance("A", -20.0)
        val b = balance("B", -20.0)

        val transfers = service.calculate(listOf(guest, a, b))

        assertEquals(2, transfers.size)
        assertTrue(transfers.all { it.toName == "Guest" })
        assertEquals(BigDecimal("40.0"), transfers.sumOf { it.amount })
    }

    @Test
    fun `multi-sharer item splits equally`() {
        // Item 90 paid by A, shared A/B/C → 30 each. A balance = 90 - 30 = +60.
        val a = balance("A", 60.0)
        val b = balance("B", -30.0)
        val c = balance("C", -30.0)

        val transfers = service.calculate(listOf(a, b, c))

        assertEquals(2, transfers.size)
        assertTrue(transfers.all { it.toName == "A" })
        assertEquals(BigDecimal("60.0"), transfers.sumOf { it.amount })
    }
```

- [ ] **Step 2: Run tests**

Run: `./gradlew test --tests "com.splitbill.webapp.DebtCalculatorServiceTest"`
Expected: PASS (all 6 tests)

- [ ] **Step 3: Commit**

```bash
git add src/test/kotlin/com/splitbill/webapp/DebtCalculatorServiceTest.kt
git commit -m "test: debt calc covers guest payer and multi-sharer split"
```

---

## Task 7: Integration tests — add-guest, assignment, full GET

**Files:**
- Modify: `src/test/kotlin/com/splitbill/webapp/WebAppControllerIntegrationTest.kt`

Requires Docker (CI). Builds on the existing `buildValidInitData` helper and seeded session.

- [ ] **Step 1: Add repository autowires**

In `WebAppControllerIntegrationTest`, after the existing `lateinit var sessionRepository`, add:

```kotlin
    @Autowired
    lateinit var itemRepository: com.splitbill.receipt.ReceiptItemRepository

    @Autowired
    lateinit var participantRepository: com.splitbill.participant.ParticipantRepository

    @Autowired
    lateinit var claimRepository: com.splitbill.split.ClaimRepository
```

- [ ] **Step 2: Add the tests**

Append these methods inside the class (uses `org.springframework.web.reactive.function.BodyInserters` — add the import; `java.util.UUID` import too):

```kotlin
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
            // roster = caller (auto-created) + guest
            .jsonPath("$.participants[?(@.displayName == 'Vasya')].isGuest").isEqualTo(true)
    }

    @Test
    fun `set assignment updates payer and sharers`() {
        val session = runBlocking {
            sessionRepository.save(SplitSession.create(creatorTelegramId = 2L, currency = "BYN")).awaitSingle()
        }
        val initData = WebAppAuthFilterTest.buildValidInitData(BOT_TOKEN, userId = 2L)

        // GET once to auto-create caller participant
        client.get().uri("/api/webapp/sessions/${session.id}")
            .header("X-Telegram-Init-Data", initData).exchange().expectStatus().isOk

        val callerId = runBlocking {
            participantRepository.findBySessionIdAndTelegramId(session.id, 2L).awaitSingle().id
        }
        // add an item
        val itemId = client.post()
            .uri("/api/webapp/sessions/${session.id}/items")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("name" to "Pizza", "price" to 30.0, "quantity" to 1))
            .exchange().expectStatus().isOk
            .expectBody().jsonPath("$.payerId").isEqualTo(callerId.toString())
            .returnResult().responseBody!!
            .let { String(it) }
            .let { Regex("\"id\":\"([0-9a-f-]+)\"").find(it)!!.groupValues[1] }

        // assign payer = caller, sharers = [caller]
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

        val itemId = client.post()
            .uri("/api/webapp/sessions/${session.id}/items")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("name" to "Beer", "price" to 5.0, "quantity" to 1))
            .exchange().expectStatus().isOk
            .returnResult(String::class.java).responseBody.blockFirst()!!
            .let { Regex("\"id\":\"([0-9a-f-]+)\"").find(it)!!.groupValues[1] }

        client.put()
            .uri("/api/webapp/sessions/${session.id}/items/$itemId/assignment")
            .header("X-Telegram-Init-Data", initData)
            .bodyValue(mapOf("payerId" to UUID.randomUUID().toString(), "sharerIds" to emptyList<String>()))
            .exchange()
            .expectStatus().isBadRequest
    }
```

Add imports at top of file: `import java.util.UUID` (if missing).

- [ ] **Step 3: Run integration tests (CI / Docker)**

Run: `./gradlew test --tests "com.splitbill.webapp.WebAppControllerIntegrationTest"`
Expected: PASS (4 tests incl. the pre-existing GET test). If Docker is unavailable locally, defer to CI.

- [ ] **Step 4: Commit**

```bash
git add src/test/kotlin/com/splitbill/webapp/WebAppControllerIntegrationTest.kt
git commit -m "test: integration coverage for add-guest and item assignment"
```

---

## Task 8: Frontend types

**Files:**
- Modify: `webapp/src/types.ts`

- [ ] **Step 1: Replace ItemDto + SessionDto, add ParticipantDto**

In `webapp/src/types.ts`, replace `ItemDto` and `SessionDto` with the following and add `ParticipantDto` (leave `ParticipantSummaryDto`, `TransferDto`, `ResultsDto` unchanged):

```ts
export interface ParticipantDto {
  id: string
  displayName: string
  isGuest: boolean
}

export interface ItemDto {
  id: string
  name: string
  price: number
  quantity: number
  payerId: string | null
  sharerIds: string[]
}

export interface SessionDto {
  id: string
  currency: string
  status: string
  participants: ParticipantDto[]
  items: ItemDto[]
  myParticipantId: string
}
```

- [ ] **Step 2: Type-check**

Run: `cd webapp && npx tsc --noEmit`
Expected: errors in `api.ts` / `session.ts` referencing old fields — expected, fixed in Tasks 9–10.

---

## Task 9: Frontend api — assignment + add-participant

**Files:**
- Modify: `webapp/src/api.ts`

- [ ] **Step 1: Replace updateClaims; add new calls**

In `webapp/src/api.ts`:
- Update the import to add `ParticipantDto`:
  `import type { SessionDto, ItemDto, ParticipantDto, ResultsDto } from './types'`
- Delete the entire `updateClaims` function.
- Add before `getResults`:

```ts
export async function setItemAssignment(
  sessionId: string,
  itemId: string,
  payerId: string,
  sharerIds: string[],
): Promise<ItemDto> {
  const res = await fetch(`${BASE}/${sessionId}/items/${itemId}/assignment`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ payerId, sharerIds }),
  })
  return handleResponse<ItemDto>(res)
}

export async function addParticipant(sessionId: string, name: string): Promise<ParticipantDto> {
  const res = await fetch(`${BASE}/${sessionId}/participants`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name }),
  })
  return handleResponse<ParticipantDto>(res)
}
```

- [ ] **Step 2: Type-check**

Run: `cd webapp && npx tsc --noEmit`
Expected: remaining errors only in `session.ts` (Task 10).

---

## Task 10: Frontend session screen — roster + per-item payer/sharers

**Files:**
- Modify: `webapp/src/screens/session.ts`

- [ ] **Step 1: Rewrite the screen**

Replace the entire contents of `webapp/src/screens/session.ts` with:

```ts
import type { SessionDto, ItemDto } from '../types'
import { getSession, addItem, uploadPhoto, setItemAssignment, addParticipant } from '../api'
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

  function nameOf(participantId: string | null): string {
    if (!participantId) return '—'
    return session.participants.find(p => p.id === participantId)?.displayName ?? '—'
  }

  function formatPrice(item: ItemDto): string {
    const total = item.price * item.quantity
    return item.quantity > 1
      ? `${item.quantity} × ${item.price} = ${total} ${session.currency}`
      : `${item.price} ${session.currency}`
  }

  function rosterOptions(selectedId: string | null): string {
    return session.participants
      .map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.displayName}</option>`)
      .join('')
  }

  async function persist(item: ItemDto) {
    try {
      const saved = await setItemAssignment(sessionId, item.id, item.payerId ?? session.myParticipantId, item.sharerIds)
      item.payerId = saved.payerId
      item.sharerIds = saved.sharerIds
    } catch (e) {
      alert(`Не удалось сохранить: ${(e as Error).message}`)
      render() // re-render from last known state
    }
  }

  function render() {
    container.innerHTML = `
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:12px">${session.currency} · ${session.status}</p>
        <div id="roster" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <label style="flex:1">
            <button id="btn-photo" style="width:100%;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">📷 Загрузить чек</button>
            <input id="photo-input" type="file" accept="image/*" style="display:none" />
          </label>
          <button id="btn-add" style="flex:1;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">+ Позиция</button>
        </div>
        <div id="items-list"></div>
        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--tg-theme-bg-color,#fff);border-top:1px solid #eee;max-width:480px;margin:0 auto">
          <button id="btn-results" style="width:100%;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:15px">Итоги →</button>
        </div>
      </div>
    `

    // roster chips + add guest
    const roster = container.querySelector('#roster')!
    session.participants.forEach(p => {
      const chip = document.createElement('span')
      chip.style.cssText = 'padding:4px 10px;border-radius:14px;background:#f0f0f0;font-size:13px'
      chip.textContent = p.isGuest ? `👤 ${p.displayName}` : p.displayName
      roster.appendChild(chip)
    })
    const addGuestBtn = document.createElement('button')
    addGuestBtn.textContent = '+ Гость'
    addGuestBtn.style.cssText = 'padding:4px 10px;border-radius:14px;border:1px dashed #ccc;background:transparent;font-size:13px'
    addGuestBtn.addEventListener('click', async () => {
      const name = prompt('Имя гостя')?.trim()
      if (!name) return
      try {
        const guest = await addParticipant(sessionId, name)
        session.participants.push(guest)
        render()
      } catch (e) {
        alert(`Ошибка: ${(e as Error).message}`)
      }
    })
    roster.appendChild(addGuestBtn)

    // items
    const list = container.querySelector('#items-list')!
    session.items.forEach(item => {
      const row = document.createElement('div')
      row.style.cssText = 'padding:12px 0;border-bottom:1px solid #f0f0f0'
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:15px">${item.name}</span>
          <span style="font-size:13px;color:#888">${formatPrice(item)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:12px;color:#888">Платил:</span>
          <select class="payer-select" style="flex:1;padding:4px;border:1px solid #ddd;border-radius:6px;font-size:13px">
            ${rosterOptions(item.payerId)}
          </select>
        </div>
        <div class="sharers" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      `

      const payerSelect = row.querySelector<HTMLSelectElement>('.payer-select')!
      payerSelect.addEventListener('change', () => {
        item.payerId = payerSelect.value
        persist(item)
      })

      const sharers = row.querySelector('.sharers')!
      session.participants.forEach(p => {
        const label = document.createElement('label')
        label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:13px'
        const checked = item.sharerIds.includes(p.id)
        label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} style="width:16px;height:16px" /> ${p.displayName}`
        const cb = label.querySelector('input')!
        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (!item.sharerIds.includes(p.id)) item.sharerIds.push(p.id)
          } else {
            item.sharerIds = item.sharerIds.filter(idv => idv !== p.id)
          }
          persist(item)
        })
        sharers.appendChild(label)
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

- [ ] **Step 2: Type-check + build**

Run: `cd webapp && npx tsc --noEmit && npm run build`
Expected: clean type-check; Vite build succeeds.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/types.ts webapp/src/api.ts webapp/src/screens/session.ts
git commit -m "feat: miniapp roster, guest add and per-position payer/sharer UI"
```

---

## Task 11: Full build + manual verification

**Files:** none (verification)

- [ ] **Step 1: Full backend build (compiles webapp too via npmBuild)**

Run: `./gradlew build -x test`
Expected: BUILD SUCCESSFUL (jar includes built webapp assets).

- [ ] **Step 2: Run all non-Docker unit tests**

Run: `./gradlew test --tests "com.splitbill.webapp.WebAppAuthFilterTest" --tests "com.splitbill.webapp.DebtCalculatorServiceTest" --tests "com.splitbill.receipt.ReceiptResultDefaultTest"`
Expected: PASS

- [ ] **Step 3: Manual verification checklist (after deploy or local run)**

Confirm in the miniapp:
- Chat: sending a photo does nothing; `/newsplit` returns the "Открыть приложение" button; message text no longer mentions receipts.
- App shows currency BYN.
- Roster chips render; "+ Гость" adds a named guest that appears as a chip and in every item's payer dropdown + sharer checkboxes.
- Each item: changing "Платил" and toggling sharer checkboxes persists (reload session — selections retained).
- Results screen shows per-person totals and correct who-owes-whom transfers, including when a guest is the payer.

- [ ] **Step 4: Final commit (if any verification fixups)**

```bash
git add -A
git commit -m "chore: miniapp-only split verification fixups"
```

---

## Notes for the implementer
- DRY: `toDto(sharerIds)` is the single item-mapping path; do not duplicate item DTO construction.
- The debt algorithm in `DebtCalculatorService` and `getResults` is intentionally untouched — payer (`uploaded_by`) credited full item, sharers (claims) debited equal shares.
- No DB migration. Existing rows: items with `uploaded_by = null` show payer unset (`—`) until assigned.
- Frontend has no JS test harness; rely on `tsc --noEmit`, `npm run build`, and the manual checklist.
