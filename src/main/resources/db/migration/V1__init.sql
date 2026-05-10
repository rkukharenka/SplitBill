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
    id          UUID          PRIMARY KEY,
    session_id  UUID          NOT NULL REFERENCES split_sessions(id) ON DELETE CASCADE,
    name        VARCHAR(500)  NOT NULL,
    price       NUMERIC(12,2) NOT NULL CHECK (price > 0),
    quantity    INT           NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
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
    ),
    CONSTRAINT chk_identity_exclusive CHECK (
        NOT (telegram_id IS NOT NULL AND guest_name IS NOT NULL)
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
CREATE INDEX idx_sessions_expires_at     ON split_sessions(expires_at);
CREATE INDEX idx_sessions_creator        ON split_sessions(creator_telegram_id);
CREATE INDEX idx_items_session_id        ON receipt_items(session_id);
CREATE INDEX idx_participants_session_id ON participants(session_id);
CREATE INDEX idx_participants_telegram   ON participants(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX idx_claims_item_id          ON claims(item_id);
CREATE INDEX idx_claims_participant_id   ON claims(participant_id);
