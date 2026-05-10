# SplitBill — План разработки

## MVP (2-3 недели) — рабочий core

### Этап 1 — Инициализация проекта
- [ ] `build.gradle.kts` со всеми зависимостями
- [ ] `docker-compose.yml` (PostgreSQL, Redis, приложение)
- [ ] `application.yml` (профили: local, prod)
- [ ] Flyway миграции: базовая схема БД
- [ ] Базовая структура пакетов

### Этап 2 — Telegram Bot
- [ ] Webhook handler (`SplitBillBot.kt`)
- [ ] Команда `/start` — приветствие + инструкция
- [ ] Команда `/newsplit` — создание новой сессии
- [ ] Команда `/help`
- [ ] `PhotoHandler` — приём фото чека

### Этап 3 — Claude Vision
- [ ] `ReceiptParserService` — отправка фото в Haiku 4.5
- [ ] Парсинг JSON-ответа в `ReceiptResult`
- [ ] Fallback: Haiku → Sonnet 4.6 при низком confidence
- [ ] Мультивалютность: Claude определяет ISO 4217 код

### Этап 4 — Сессии и хранение
- [ ] Entity `SplitSession`, `ReceiptItem`, `Participant`, `Claim`
- [ ] `SplitSessionService` — CRUD операции
- [ ] `SplitSessionRepository` (Spring Data R2DBC)
- [ ] Scheduled job — автоудаление через 48 часов

### Этап 5 — REST API для Mini App
- [ ] `SessionController` — GET сессии
- [ ] `ParticipantController` — добавление участников (Telegram + гости)
- [ ] `ClaimController` — выбор/отмена позиций
- [ ] `SecurityConfig` — валидация Telegram `initData`
- [ ] DTO + маппинг

### Этап 6 — Бизнес-логика расчёта
- [ ] `SplitCalculator` — расчёт долей с учётом разделения позиций
- [ ] Логика чаевых (процент от суммы каждого)
- [ ] `SplitResult` — итоговый объект

### Этап 7 — Mini App (React)
- [ ] Инициализация проекта (Vite + React + TypeScript)
- [ ] Telegram Web App SDK интеграция
- [ ] `ReceiptPage` — список позиций, ручное добавление/редактирование
- [ ] `ClaimPage` — выбор блюд, разделение позиций между участниками
- [ ] `ResultPage` — итоги, суммы к оплате

---

## V1 (1-2 недели) — polish

### Этап 8 — Чаевые и реквизиты
- [ ] UI чаевых в ClaimPage: кнопки 0/10/15/20% + произвольный ввод
- [ ] Профиль пользователя: сохранение реквизитов (карта/телефон/банк)
- [ ] `PaymentTextGenerator` — генерация текста для перевода
- [ ] Копирование суммы и реквизитов в ResultPage

### Этап 9 — Уведомления
- [ ] `NotificationService` — отправка напоминаний через Telegram Bot API
- [ ] Кнопка "Напомнить" в ResultPage
- [ ] Фильтрация: пинговать только Telegram-участников, не выбравших блюда

### Этап 10 — Мультивалютность и rate limiting
- [ ] Отображение символа валюты в Mini App
- [ ] Redis rate limiting на загрузку фото (защита от спама в Claude API)

---

## V2 (1-2 недели) — дополнения

### Этап 11 — PDF экспорт
- [ ] `PdfExportService` — генерация PDF с итогами
- [ ] Эндпоинт `GET /api/sessions/{id}/export/pdf`
- [ ] Кнопка в ResultPage

### Этап 12 — Инфра и деплой
- [ ] nginx конфиг (reverse proxy, SSL termination)
- [ ] Let's Encrypt (certbot)
- [ ] Скрипт деплоя для Servitro VPS
- [ ] GitHub Actions CI/CD pipeline

### Этап 13 — Качество
- [ ] Unit тесты: `SplitCalculator`, `ReceiptParserService` (MockK)
- [ ] Integration тесты: API endpoints (Testcontainers + PostgreSQL)
- [ ] Нагрузочное тестирование

---

## Технический долг (после V2)
- WebSocket / SSE для реалтайм обновлений в ClaimPage (сейчас polling)
- Метрики и мониторинг (Micrometer + Prometheus)
- Admin панель для просмотра сессий
