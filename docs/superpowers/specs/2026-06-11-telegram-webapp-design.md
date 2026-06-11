# Telegram Mini App — Design Spec

**Date:** 2026-06-11  
**Status:** Approved

## Overview

Telegram Mini App (WebApp) полностью заменяет текстовые команды бота для управления сессией разделения счёта. Бот добавляется в групповой чат; команда `/newsplit` создаёт сессию и кидает кнопку открытия Mini App. Каждый участник группы может добавлять позиции (фото чека или вручную) и отмечать что взял.

## Architecture

```
Группа в Telegram
    │
    ├─ /newsplit → бот создаёт SplitSession (chat_id группы)
    │              кидает InlineKeyboardButton[web_app] → url = ${TELEGRAM_WEBAPP_URL}/webapp/
    │
    └─ Кнопка → открывает Mini App
                    │
                    ├─ Frontend: Vanilla TS, собирается Vite
                    │   output: src/main/resources/static/webapp/
                    │
                    └─ Backend: REST /api/webapp/*
                        auth: X-Telegram-Init-Data (HMAC-SHA256 + bot token)
                        переиспользует ReceiptParserService, SplitSessionService
```

### Изменения модели данных

- `SplitSession` +поле `chat_id BIGINT` — привязка к группе (новая миграция Flyway)
- `ReceiptItemEntity` +поле `uploaded_by UUID` (FK → participants) — кто добавил позицию = плательщик
- `Participant` — без изменений (уже поддерживает `telegram_id` и `guest_name`)

### Auth

Каждый запрос несёт заголовок `X-Telegram-Init-Data: <raw initData>`.  
`WebAppAuthFilter` валидирует HMAC-SHA256 с bot token, извлекает `user.id`.  
Если участника нет в сессии — создаётся автоматически при первом входе.

## Screens

### Главный экран (Session)

- Заголовок сессии + счётчик участников и чеков
- Кнопки: `[+ Загрузить чек]`, `[+ Позиция]`
- Список всех позиций с чекбоксами (= claims текущего пользователя)
- Чекбокс тапается → PUT /claims сразу (optimistic update)
- Строка внизу: "Мои позиции: X ₽" + кнопка `[Итоги сессии]`

### Добавление чека (фото)

- Нативный `<input type="file" accept="image/*">`
- POST multipart → `ReceiptParserService` (Claude Haiku → fallback Sonnet)
- Позиции добавляются в список без перезагрузки страницы

### Добавление позиции вручную

- Модалка: поля `название`, `цена`, `количество`
- POST /items → позиция сразу появляется в списке

### Экран результатов

- Таблица: участник → его сумма
- Секция "Переводы": список минимальных транзакций (greedy алгоритм)
- Формат: `Маша → Иван 430 ₽`

## REST API

Base path: `/api/webapp`  
Auth: `X-Telegram-Init-Data` header на каждом запросе

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/sessions/{id}` | Сессия + все позиции + claims текущего юзера |
| `POST` | `/sessions/{id}/items` | Добавить позицию вручную `{name, price, quantity}` |
| `POST` | `/sessions/{id}/photo` | Загрузить фото чека (multipart/form-data) |
| `PUT` | `/sessions/{id}/claims` | Сохранить выбор `{itemIds: [uuid...]}` |
| `GET` | `/sessions/{id}/results` | Итоги: суммы + список переводов |

## Backend структура

```
com.splitbill.webapp/
  WebAppController.kt         — все endpoint-ы
  WebAppAuthFilter.kt         — валидация initData, кладёт userId в атрибуты запроса
  dto/
    SessionDto.kt             — ответы API
  DebtCalculatorService.kt    — greedy алгоритм расчёта долгов
```

### Алгоритм долгов (greedy)

Отслеживаем два потока денег на участника:
- `paid` = сумма позиций, которые он загрузил/добавил (`uploaded_by`)
- `owed` = сумма позиций, которые он отметил (`claims`)

Баланс = `paid - owed`
- Положительный баланс → ему должны деньги
- Отрицательный баланс → он должен деньги

Минимизация переводов (greedy):
1. Сортируем участников по балансу
2. Два указателя: наибольший должник (баланс << 0) и наибольший кредитор (баланс >> 0)
3. Должник переводит кредитору `min(|должник|, |кредитор|)`
4. Обновляем балансы, повторяем до обнуления

Позиции без `uploaded_by` (добавленные без привязки к плательщику) не участвуют в расчёте переводов — только в суммах участников.

## Frontend структура

```
webapp/                         ← корень проекта
  src/
    main.ts                     — точка входа, роутинг экранов
    api.ts                      — fetch-обёртки с initData в header
    screens/
      session.ts                — главный экран
      results.ts                — экран итогов
    components/
      addItemModal.ts           — модалка ручного ввода
  index.html                    — подключает telegram-web-app.js
  vite.config.ts                — outDir: ../src/main/resources/static/webapp
  tsconfig.json
  package.json
```

### Build интеграция

- Gradle task `npmBuild` → `npm run build` в `webapp/`
- `bootJar` зависит от `npmBuild`
- Dev: `vite --watch` + `./gradlew bootRun` параллельно

## Изменения в боте

- `NewSplitCommand`: сохранять `chat_id`, отправлять `InlineKeyboardButton` с `WebAppInfo(url)`
- Бот должен поддерживать групповые чаты: добавить `group` и `supergroup` в allowed updates
