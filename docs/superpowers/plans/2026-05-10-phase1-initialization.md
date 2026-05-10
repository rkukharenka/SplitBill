# SplitBill: Этап 1 — Инициализация проекта

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Преобразовать пустой Kotlin/Gradle проект в рабочий Spring Boot 3.x скелет с PostgreSQL, Redis, Flyway и базовой DB-схемой.

**Architecture:** Spring WebFlux (реактивный) + R2DBC для runtime, JDBC только для Flyway миграций. Telegram/Claude конфиги объявляются через `@ConfigurationProperties`, реальные значения через env vars. Тест поднимает PostgreSQL и Redis через Testcontainers.

**Tech Stack:** Kotlin 2.3.20, Spring Boot 3.4.5, R2DBC PostgreSQL, Flyway 10.x, Redis Reactive, TelegramBots 9.5.0, Anthropic Java SDK 2.27.0, Testcontainers, MockK 1.14.2

---

## Файлы

| Действие | Путь |
|----------|------|
| Modify | `build.gradle.kts` |
| Create | `src/main/kotlin/com/splitbill/SplitBillApplication.kt` |
| Create | `src/main/resources/application.yml` |
| Create | `src/main/resources/application-local.yml` |
| Create | `src/main/resources/application-test.yml` |
| Create | `src/main/resources/db/migration/V1__init.sql` |
| Create | `docker-compose.yml` |
| Create | `.env.example` |
| Create | `src/test/kotlin/com/splitbill/SplitBillApplicationTest.kt` |

---

## Task 1: Перепишем build.gradle.kts

**Files:**
- Modify: `build.gradle.kts`

> **Kotlin для Java-разработчиков:** `kotlin("plugin.spring")` нужен чтобы Spring мог создавать прокси для Kotlin-классов — по умолчанию классы в Kotlin `final`, а Spring требует наследуемые классы для AOP. Плагин автоматически добавляет `open` к нужным классам.

- [ ] **Step 1: Напиши failing smoke test (пустой — он упадёт из-за отсутствия зависимостей)**

```kotlin
// src/test/kotlin/com/splitbill/SplitBillApplicationTest.kt
package com.splitbill

import org.junit.jupiter.api.Test

class SplitBillApplicationTest {
    @Test
    fun contextLoads() {}
}
```

- [ ] **Step 2: Запусти тест — убедись что падает**

```bash
./gradlew test
```

Ожидаем: FAIL — нет зависимостей Spring Boot

- [ ] **Step 3: Замени build.gradle.kts**

```kotlin
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "2.3.20"
    kotlin("plugin.spring") version "2.3.20"
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.splitbill"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot WebFlux — реактивный web-слой
    implementation("org.springframework.boot:spring-boot-starter-webflux")

    // R2DBC — реактивный драйвер PostgreSQL
    implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")
    implementation("org.postgresql:r2dbc-postgresql")

    // JDBC PostgreSQL — только для Flyway миграций (не для runtime)
    implementation("org.postgresql:postgresql")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    // Redis реактивный
    implementation("org.springframework.boot:spring-boot-starter-data-redis-reactive")

    // Kotlin ecosystem
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("io.projectreactor.kotlin:reactor-kotlin-extensions")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")

    // Telegram Bot API
    implementation("org.telegram:telegrambots-longpolling:9.5.0")
    implementation("org.telegram:telegrambots-client:9.5.0")

    // Anthropic Claude SDK
    implementation("com.anthropic:anthropic-java:2.27.0")

    // Actuator — health checks для деплоя
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("io.mockk:mockk:1.14.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
    testImplementation("org.testcontainers:testcontainers")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:r2dbc")
    testImplementation("org.testcontainers:junit-jupiter")
}

tasks.withType<KotlinCompile> {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

---

## Task 2: SplitBillApplication.kt

**Files:**
- Create: `src/main/kotlin/com/splitbill/SplitBillApplication.kt`

> **Kotlin для Java-разработчиков:** `runApplication<SplitBillApplication>(*args)` — это extension function из Spring Boot Kotlin DSL. `*args` — spread-оператор, разворачивает Array в vararg. Эквивалент Java: `SpringApplication.run(SplitBillApplication.class, args)`.

- [ ] **Step 1: Создай главный класс приложения**

```kotlin
package com.splitbill

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class SplitBillApplication

fun main(args: Array<String>) {
    runApplication<SplitBillApplication>(*args)
}
```

---

## Task 3: application.yml и профили

**Files:**
- Create: `src/main/resources/application.yml`
- Create: `src/main/resources/application-local.yml`
- Create: `src/main/resources/application-test.yml`

> **Про Flyway + R2DBC:** Spring Boot не может запустить Flyway через R2DBC-соединение — Flyway требует JDBC. Решение: задаём `spring.flyway.url` отдельно (JDBC URL), тогда Spring Boot создаёт изолированное JDBC-соединение только для миграций, не влияя на реактивный R2DBC runtime.

- [ ] **Step 1: Создай базовый application.yml**

```yaml
spring:
  application:
    name: splitbill
  r2dbc:
    url: r2dbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:splitbill}
    username: ${DB_USER:splitbill}
    password: ${DB_PASSWORD:splitbill}
  flyway:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:splitbill}
    user: ${DB_USER:splitbill}
    password: ${DB_PASSWORD:splitbill}
    enabled: true
    locations: classpath:db/migration
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}

telegram:
  bot:
    token: ${TELEGRAM_BOT_TOKEN}
    username: ${TELEGRAM_BOT_USERNAME}
    webhook-url: ${TELEGRAM_WEBHOOK_URL:}

claude:
  api-key: ${ANTHROPIC_API_KEY}
  haiku-model: claude-haiku-4-5-20251001
  sonnet-model: claude-sonnet-4-6

management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: when-authorized
```

- [ ] **Step 2: Создай application-local.yml для локальной разработки**

```yaml
# Значения по умолчанию совпадают с docker-compose.yml
# Запусти docker-compose up -d перед ./gradlew bootRun
spring:
  r2dbc:
    url: r2dbc:postgresql://localhost:5432/splitbill
    username: splitbill
    password: splitbill
  flyway:
    url: jdbc:postgresql://localhost:5432/splitbill
    user: splitbill
    password: splitbill
  data:
    redis:
      host: localhost
      port: 6379

telegram:
  bot:
    token: ${TELEGRAM_BOT_TOKEN:change-me}
    username: ${TELEGRAM_BOT_USERNAME:change_me_bot}
    webhook-url: ${TELEGRAM_WEBHOOK_URL:}

claude:
  api-key: ${ANTHROPIC_API_KEY:change-me}
```

- [ ] **Step 3: Создай application-test.yml с заглушками внешних сервисов**

```yaml
# Telegram и Claude — заглушки (реальные значения не нужны для context load теста)
telegram:
  bot:
    token: test-token-stub
    username: test_bot_stub
    webhook-url: ""

claude:
  api-key: test-api-key-stub
  haiku-model: claude-haiku-4-5-20251001
  sonnet-model: claude-sonnet-4-6
```

---

## Task 4: Flyway миграция V1

**Files:**
- Create: `src/main/resources/db/migration/V1__init.sql`

- [ ] **Step 1: Создай начальную схему БД**

```sql
-- Сессии разделения счёта
CREATE TABLE split_sessions (
    id                  UUID PRIMARY KEY,
    creator_telegram_id BIGINT       NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    currency            VARCHAR(3)   NOT NULL DEFAULT 'RUB',
    tip_percent         NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED'))
);

-- Позиции из чека
CREATE TABLE receipt_items (
    id          UUID         PRIMARY KEY,
    session_id  UUID         NOT NULL REFERENCES split_sessions(id) ON DELETE CASCADE,
    name        VARCHAR(500) NOT NULL,
    price       NUMERIC(12,2) NOT NULL CHECK (price > 0),
    quantity    INT          NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Участники разделения (Telegram-пользователи или гости по имени)
CREATE TABLE participants (
    id                 UUID         PRIMARY KEY,
    session_id         UUID         NOT NULL REFERENCES split_sessions(id) ON DELETE CASCADE,
    telegram_id        BIGINT,
    guest_name         VARCHAR(100),
    payment_requisites TEXT,
    joined_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_identity CHECK (
        (telegram_id IS NOT NULL) OR (guest_name IS NOT NULL)
    )
);

-- Выборы: какой участник выбрал какую позицию
-- Если позицию выбрали N участников — стоимость делится на N
CREATE TABLE claims (
    id             UUID        PRIMARY KEY,
    item_id        UUID        NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
    participant_id UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, participant_id)
);

-- Индексы для производительности
CREATE INDEX idx_sessions_expires_at        ON split_sessions(expires_at);
CREATE INDEX idx_sessions_creator           ON split_sessions(creator_telegram_id);
CREATE INDEX idx_items_session_id           ON receipt_items(session_id);
CREATE INDEX idx_participants_session_id    ON participants(session_id);
CREATE INDEX idx_participants_telegram_id   ON participants(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX idx_claims_item_id             ON claims(item_id);
CREATE INDEX idx_claims_participant_id      ON claims(participant_id);
```

---

## Task 5: docker-compose.yml

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Создай docker-compose.yml (только инфраструктура — для локальной разработки)**

```yaml
# Для локальной разработки: только PostgreSQL и Redis
# Приложение запускается отдельно: ./gradlew bootRun -Pspring.profiles.active=local
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: splitbill
      POSTGRES_USER: splitbill
      POSTGRES_PASSWORD: splitbill
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U splitbill -d splitbill"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **Step 2: Создай .env.example**

```bash
# Скопируй в .env и заполни реальными значениями
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

ANTHROPIC_API_KEY=your_anthropic_api_key

# БД (для docker-compose значения по умолчанию уже выставлены)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=splitbill
DB_USER=splitbill
DB_PASSWORD=splitbill

REDIS_HOST=localhost
REDIS_PORT=6379
```

- [ ] **Step 3: Добавь .env в .gitignore**

Убедись что в `.gitignore` есть строка:
```
.env
```

---

## Task 6: Smoke-тест с Testcontainers

**Files:**
- Modify: `src/test/kotlin/com/splitbill/SplitBillApplicationTest.kt`

> **Kotlin для Java-разработчиков:** `companion object` — это синглтон внутри класса, аналог `static` в Java. `@JvmStatic` нужен чтобы JUnit мог вызывать статические методы (Testcontainers требует статические поля для контейнеров). Без `@JvmStatic` JUnit не увидит companion-метод как static.

- [ ] **Step 1: Запусти docker-compose**

```bash
docker compose up -d
```

Ожидаем: PostgreSQL и Redis поднялись и healthy

- [ ] **Step 2: Замени SplitBillApplicationTest.kt на полноценный Testcontainers-тест**

```kotlin
package com.splitbill

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class SplitBillApplicationTest {

    companion object {
        // PostgreSQLContainer<Nothing> — Nothing как type param т.к. не расширяем контейнер
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer<Nothing>("postgres:17-alpine").apply {
            withDatabaseName("splitbill_test")
            withUsername("splitbill")
            withPassword("splitbill")
        }

        @Container
        @JvmStatic
        val redis = GenericContainer<Nothing>("redis:7-alpine").apply {
            withExposedPorts(6379)
        }

        // DynamicPropertySource — переопределяет properties ДО старта Spring контекста
        @DynamicPropertySource
        @JvmStatic
        fun configureProperties(registry: DynamicPropertyRegistry) {
            // R2DBC URL для runtime
            registry.add("spring.r2dbc.url") {
                "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}"
            }
            registry.add("spring.r2dbc.username") { postgres.username }
            registry.add("spring.r2dbc.password") { postgres.password }

            // JDBC URL только для Flyway
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }

            // Redis
            registry.add("spring.data.redis.host") { redis.host }
            registry.add("spring.data.redis.port") { redis.firstMappedPort.toString() }
        }
    }

    @Test
    fun `context loads and Flyway migrations run`() {
        // Если контекст поднялся — Spring + R2DBC + Flyway + Redis настроены верно
    }
}
```

- [ ] **Step 3: Запусти тест**

```bash
./gradlew test
```

Ожидаем: BUILD SUCCESSFUL, тест GREEN

Если тест падает с `Unable to connect` — проверь что docker compose up прошёл успешно:
```bash
docker compose ps
```

- [ ] **Step 4: Коммит**

```bash
git add build.gradle.kts \
        src/main/kotlin/com/splitbill/SplitBillApplication.kt \
        src/main/resources/application.yml \
        src/main/resources/application-local.yml \
        src/main/resources/application-test.yml \
        src/main/resources/db/migration/V1__init.sql \
        docker-compose.yml \
        .env.example \
        src/test/kotlin/com/splitbill/SplitBillApplicationTest.kt \
        docs/
git commit -m "chore: initialize Spring Boot 3.4.5 project scaffold

- Spring WebFlux + R2DBC + Flyway + Redis setup
- PostgreSQL schema: split_sessions, receipt_items, participants, claims
- Testcontainers smoke test verifies context loads
- docker-compose for local infra (PostgreSQL + Redis)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Spring Boot 3.x с WebFlux — настроен
- ✅ PostgreSQL + Flyway — schema создана, миграция V1
- ✅ Redis — starter подключён
- ✅ Telegram зависимости — добавлены (реализация в Этапе 2)
- ✅ Anthropic SDK — добавлен (реализация в Этапе 3)
- ✅ Корутины — `kotlinx-coroutines-reactor` и `kotlinx-coroutines-core` добавлены
- ✅ Docker Compose — только инфра для local dev
- ✅ Тесты через Testcontainers — MockK и JUnit 5 готовы
- ✅ Профили local/prod разделены

**Placeholders:** нет.

**Type consistency:** нет перекрёстных ссылок между задачами — каждая самодостаточна.
