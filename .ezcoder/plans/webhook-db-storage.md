# Plan: Migrate Public Webhook Subscriptions to Database

## Problem

`backend/app/api/v1/public/webhooks.py` lines 100–157 define a `PublicWebhook` class using a class-variable `_webhooks: dict[uuid.UUID, dict[str, Any]] = {}` for in-memory storage. This causes:

- Subscriptions lost on restart
- Cross-worker inconsistency in multi-worker deployments (secrets shared by `trigger_public_webhooks` won't work cross-worker)
- `trigger_public_webhooks` currently only queries `actor.id`'s webhooks, missing cross-user triggered events

## What Already Exists

- `backend/app/models/webhook.py` — `Webhook` model linked to `partner_profiles.id` (not `users.id`). **This is for partner-portal configured webhooks, separate from public API subscriptions.** We create a distinct model.
- `backend/app/models/api_key.py` — `APIKey` model linked to `users.id` (the auth mechanism for the public API). This is the correct FK target.
- `backend/app/schemas/public_api.py` — `PublicWebhookCreate` and `PublicWebhookResponse` already exist and look correct. `PublicWebhookResponse` uses `from_attributes=True`.
- Migration chain: head is `52aacd4f3335`.

## Solution

1. **New ORM model** `PublicWebhookSubscription` in `backend/app/models/public_webhook.py`  
   - Table `public_webhook_subscriptions`
   - Fields: `id` (UUID PK), `user_id` (FK → `users.id` CASCADE), `url` (String 500), `secret` (String 100), `events` (ARRAY(String)), `is_active` (Boolean), `description` (String 255 nullable), `created_at`, `updated_at`
   - Index: `(user_id, is_active)`

2. **Register** the new model in `backend/app/models/__init__.py`

3. **Alembic migration** `backend/alembic/versions/add_public_webhook_subscriptions.py`  
   - `down_revision = "52aacd4f3335"` (current head)
   - Creates `public_webhook_subscriptions` table with proper indexes

4. **Rewrite** `get_governance_dashboard`... wait — wrong plan, this is the webhook plan.

4. **Rewrite** `backend/app/api/v1/public/webhooks.py`:
   - Remove the `PublicWebhook` in-memory class entirely
   - Add `db: AsyncSession = Depends(get_db)` to `create_webhook`, `list_webhooks`, `delete_webhook`
   - `create_webhook`: instantiate `PublicWebhookSubscription`, `db.add`, `db.commit`, `db.refresh`, return from ORM object
   - `list_webhooks`: `SELECT PublicWebhookSubscription WHERE user_id = user.id AND is_active = True`
   - `delete_webhook`: `SELECT … WHERE id = webhook_id AND user_id = user.id`, then delete (or soft-delete by setting `is_active = False` — match existing behavior which is hard delete)
   - `trigger_public_webhooks`: accept `db` (already passed), query all active subscriptions matching `event_type` for any user (not just actor) — or keep actor-scoped for now and just use DB

   **Note on `trigger_public_webhooks`**: The current signature accepts `actor: User | None` and only fetches that actor's webhooks. This is intentional (each user subscribes to their own events). We keep that semantic, just switch storage to DB. The `db` parameter is already in the signature.

5. **Run** `cd backend && ruff check . && mypy .` and fix any issues.

## Files Changed

- `backend/app/models/public_webhook.py` — new file
- `backend/app/models/__init__.py` — add import
- `backend/alembic/versions/add_public_webhook_subscriptions.py` — new migration
- `backend/app/api/v1/public/webhooks.py` — rewrite webhook storage methods

## Implementation Order

1. Create `backend/app/models/public_webhook.py`
2. Add to `backend/app/models/__init__.py`
3. Create Alembic migration `backend/alembic/versions/add_public_webhook_subscriptions.py`
4. Rewrite storage in `backend/app/api/v1/public/webhooks.py`
5. Run linter + type checker
