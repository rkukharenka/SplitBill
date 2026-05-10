# SplitBill — Архитектура

## Стек

| Слой | Технология |
|------|-----------|
| Язык | Kotlin |
| Фреймворк | Spring Boot 3.x, Spring WebFlux (coroutines) |
| БД | PostgreSQL + Flyway миграции |
| Кэш | Redis (сессии, rate limiting) |
| Telegram | kotlin-telegram-bot или TelegramBots Spring Boot Starter |
| AI | Anthropic SDK — Haiku 4.5 (Vision), fallback Sonnet 4.6 |
| Mini App | React + TypeScript + Telegram Web App SDK |
| Инфра | Docker + docker-compose |
| Тесты | JUnit 5 + Testcontainers + MockK |

---

## Структура бэкенда

```
src/main/kotlin/com/splitbill/
├── SplitBillApplication.kt
├── bot/                          # Telegram Bot
│   ├── SplitBillBot.kt           # Webhook handler
│   ├── command/                  # /start, /help, /newsplit
│   └── handler/                  # PhotoHandler, CallbackHandler
├── receipt/                      # Парсинг чеков
│   ├── ReceiptParserService.kt   # Claude Vision API
│   ├── ReceiptItem.kt
│   └── ReceiptResult.kt
├── session/                      # Сессии разделения
│   ├── SplitSession.kt           # Entity
│   ├── SplitSessionService.kt
│   └── SplitSessionRepository.kt
├── participant/                  # Участники
│   ├── Participant.kt            # telegramId? + guestName?
│   └── ParticipantService.kt
├── split/                        # Бизнес-логика
│   ├── SplitCalculator.kt        # Расчёт долей
│   ├── PaymentTextGenerator.kt   # Генерация текста перевода
│   └── SplitResult.kt
├── api/                          # REST для Mini App
│   ├── SessionController.kt      # GET /api/sessions/{id}
│   ├── ClaimController.kt        # POST /api/claims
│   ├── ParticipantController.kt  # POST /api/sessions/{id}/participants
│   └── dto/
├── export/                       # PDF экспорт
│   └── PdfExportService.kt
├── notification/                 # Уведомления
│   └── NotificationService.kt
└── config/
    ├── BotConfig.kt
    ├── ClaudeConfig.kt
    ├── RedisConfig.kt
    └── SecurityConfig.kt         # Telegram InitData validation
```

---

## Mini App — экраны

### ReceiptPage
- Список распознанных позиций с ценами
- Редактирование позиций (если AI ошибся)
- Ручное добавление позиций
- Выбор валюты (если Claude не распознал)

### ClaimPage
- Каждый участник тапает свои блюда
- Позиция с несколькими участниками → стоимость делится поровну
- Общие позиции помечаются "на всех"
- Реалтайм обновление: кто что выбрал
- Выбор чаевых: кнопки 0/10/15/20% + произвольный ввод

### ResultPage
- Итог для каждого участника
- Текст для ручного перевода с реквизитами инициатора
- Кнопки копирования суммы
- Кнопка "Напомнить" — пинг не выбравших участников
- Кнопка экспорта в PDF

---

## Ключевые принципы

- **Webhook** вместо polling
- **Валидация Telegram InitData** во всех Mini App запросах
- **Graceful fallback:** Haiku 4.5 → Sonnet 4.6 при низком качестве парсинга
- **Корутины** для асинхронных операций (не `@Async`)
- **Structured concurrency** где уместно
- **Идиоматический Kotlin:** `data class`, `sealed class`, extension functions
- **Чистая архитектура:** домен не зависит от фреймворка

---

## Модель данных (концептуально)

```
SplitSession
├── id: UUID
├── creatorTelegramId: Long
├── status: ACTIVE | COMPLETED | EXPIRED
├── currency: String (ISO 4217)
├── tipPercent: BigDecimal
├── expiresAt: Instant (createdAt + 48h)
└── items: List<ReceiptItem>

ReceiptItem
├── id: UUID
├── name: String
├── price: BigDecimal
├── quantity: Int
└── claims: List<Claim>

Participant
├── id: UUID
├── sessionId: UUID
├── telegramId: Long?       # null для гостей
├── guestName: String?      # null для Telegram-юзеров
└── paymentRequisites: String?

Claim
├── itemId: UUID
├── participantId: UUID
└── share: BigDecimal       # price / кол-во участников выбравших позицию
```

---

## API эндпоинты

```
GET  /api/sessions/{id}              # Данные сессии + позиции + участники
POST /api/sessions/{id}/participants # Добавить участника (гость или Telegram)
GET  /api/sessions/{id}/items        # Список позиций
POST /api/sessions/{id}/items        # Добавить позицию вручную
PUT  /api/sessions/{id}/items/{itemId} # Редактировать позицию
POST /api/claims                     # Выбрать позицию (claim)
DELETE /api/claims/{claimId}         # Отменить выбор
GET  /api/sessions/{id}/result       # Итог расчёта
GET  /api/sessions/{id}/export/pdf   # PDF экспорт
POST /api/sessions/{id}/notify       # Отправить напоминания
```
