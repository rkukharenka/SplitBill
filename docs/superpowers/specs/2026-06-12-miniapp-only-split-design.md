# Miniapp-Only Bill Splitting — Design

Date: 2026-06-12
Status: Approved (pending written review)

## Goal

Move all bill-splitting interaction into the Telegram miniapp. The group chat is used only
to create a new session. Switch currency to BYN. Support per-position assignment of who pays
and who shares each item, including manually-added guests who never open the app, so the
results show who owes whom.

## Scope

In scope:
1. Strip receipt handling from chat; chat creates sessions only.
2. Default currency BYN everywhere.
3. Roster = participants who opened the app + manually-added guests.
4. Per-position assignment: payer (one) + sharers (many), editable by anyone who opened the app.
5. Results screen: read-only per-person totals and who-owes-whom transfers.

Out of scope (YAGNI):
- Listing real Telegram group members (Bot API cannot enumerate group members).
- Equal-split mode / include-exclude checkboxes in results.
- Editing/removing items (unchanged from today unless already present).

## Decisions

- **Approach A**: assignment lives on the session (items) screen, next to each item. Results are
  read-only.
- **Roster source**: hybrid — joined app users (auto-created on first open) plus guests added by
  name in the app.
- **Split model**: per-position. An item's price splits equally among its sharers; the payer is
  credited the full item amount.
- **Assignment permission**: anyone who opened the app may set payer and sharers for any item
  (claims are shared session state, not per-user).
- **Payer per position**: required. Defaults to the participant who added the item; can be any
  roster member (including a guest who actually paid).

## Architecture

### Bot (chat)
- Remove `PhotoHandler` and its dispatch branch in `SplitBillBot.consume`.
- `SplitBillBot` keeps `/start`, `/help`, `/newsplit` only.
- `NewSplitCommand`: create empty session with currency `BYN`; message text no longer mentions
  uploading receipts — only "open the app".
- Delete `PhotoHandler.kt`. Keep `ReceiptParserService` (used by the miniapp upload endpoint).

### Currency
- `SplitSession.currency` default → `"BYN"`.
- `NewSplitCommand` passes `"BYN"`.
- `ReceiptParserService`: prompt examples and `ReceiptResult.currency` default → `"BYN"`. The
  parser still returns whatever currency it detects from the receipt; only the fallback/default
  becomes BYN.
- Webapp: currency comes from `SessionDto.currency`; no hardcoded "RUB" in TS.

### Data model
No schema migration required. Existing tables already support everything:
- `participants.guest_name` → guests.
- `claims (item_id, participant_id)` → sharers (many per item).
- `receipt_items.uploaded_by` → reused as **payer** (participant id). Already nullable FK to
  participants.

### API (WebAppController, base `/api/webapp/sessions`)

Changed `GET /{id}` → returns full session for the working screen:
```
SessionDto {
  id, currency, status,
  participants: [ { id, displayName, isGuest } ],   // full roster
  items: [ { id, name, price, quantity, payerId, sharerIds: [participantId...] } ],
  myParticipantId
}
```
- `myParticipantId`: the caller's participant (auto-created on first open, as today).

New `POST /{id}/participants` — add a guest:
```
body: { name: String }
returns: ParticipantDto { id, displayName, isGuest }
```
- Validates non-blank name. Creates `Participant.guest(sessionId, name)`.

New `PUT /{id}/items/{itemId}/assignment` — set payer + sharers (anyone may call):
```
body: { payerId: UUID, sharerIds: [UUID...] }
returns: ItemDto
```
- Validates `payerId` and all `sharerIds` belong to this session's roster.
- Sets `receipt_items.uploaded_by = payerId`.
- Replaces the item's claims: delete claims for this item, insert one per sharerId.

Unchanged:
- `POST /{id}/items` (add item) — sets `payerId` = caller's participant by default; sharers empty
  until assigned.
- `POST /{id}/photo` (upload + parse) — same default payer behavior for each created item.
- `GET /{id}/results` — recomputed against the shared claims/payer (algorithm unchanged).

Removed:
- `PUT /{id}/claims` (per-caller claim toggle) — replaced by per-item assignment.

DTOs: extend `SessionDto`; add `ParticipantDto`, `ItemAssignmentRequest`, `AddParticipantRequest`.
`ItemDto` gains `payerId` and `sharerIds`.

### Webapp UI

Session screen (`session.ts`):
- Roster bar: list participants + "+ Гость" button (calls `POST /participants`, refreshes).
- Per item row:
  - name + price (as today),
  - **Платил**: dropdown of roster (default = adder),
  - **Делят**: multi checkboxes of roster.
  - Any change → `PUT /items/{itemId}/assignment`. Optimistic with rollback on error (as the
    current claim toggle does).
- Keep photo upload + manual add buttons.
- "Итоги →" button unchanged.

Results screen (`results.ts`): read-only, unchanged structure — per-person totals + transfers.
No checkboxes. Uses `session.currency` for formatting.

`api.ts` / `types.ts`: replace `updateClaims` with `setItemAssignment(sessionId, itemId, payerId, sharerIds)`; add `addParticipant(sessionId, name)`. Update `SessionDto`/`ItemDto` types; add `ParticipantDto`.

### Debt calculation
`DebtCalculatorService` algorithm unchanged:
- Each item: amount = price × quantity; split equally among its sharers (claim count).
- Payer (`uploaded_by`) is credited the full item amount; each sharer is debited their share.
- Balance = paid − owed; transfers minimize who-pays-whom.
Guest-as-payer works: a guest credited as payer becomes a creditor in transfers.

## Error handling
- `POST /participants`: 400 on blank name; 404 if session missing.
- `PUT /assignment`: 404 if session/item missing; 400 if payerId or any sharerId not in roster.
- Existing 401 (initData) and not-found behaviors unchanged.

## Testing
- `WebAppAuthFilterTest`, `DebtCalculatorServiceTest`: keep; extend debt test with a guest payer
  and a multi-sharer item.
- `WebAppControllerIntegrationTest` (testcontainers): cover add-guest, set-assignment (payer +
  sharers), and `GET /{id}` returning full roster + per-item payer/sharers.
- Frontend: manual verification in miniapp (no JS test harness today).

## Migration / compatibility
- No DB migration. Existing sessions keep working: items with `uploaded_by = null` show payer
  unset until assigned; existing claims render as sharers.
- Old `PUT /claims` removed — the new webapp build is deployed together, so no stale client.
