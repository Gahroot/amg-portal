# Phase 2 — Implementation Notes

Completed 2026-04-20.  Covers all 15 items from `docs/security-plan.md` §6 Phase 2.

## What landed

### File vault (2.1–2.6)
- `backend/app/core/file_crypto.py` — AES-256-GCM chunked envelope (1 MiB segments, per-segment AAD + deterministic nonce).
- `backend/app/services/clamav.py` — self-contained clamd INSTREAM client (no external dep).
- `docker-compose.yml` — `clamav/clamav:1.3` service on port 3310, health-checked.
- `backend/app/services/storage.py` — `upload_encrypted_bytes`, `fetch_ciphertext`, `iter_decrypted_chunks`; MinIO bucket created with `object_lock=True`; COMPLIANCE Retention on compliance/contract categories.
- `backend/app/api/v1/files.py` — new router at `/api/v1/files`:
  - `POST /upload` — validate → ClamAV → envelope-encrypt → MinIO + lock.
  - `GET /{id}/stream` — proxy-through decrypt (non-sensitive).
  - `GET /{id}/stream-gated` — proxy-through gated on step-up (sensitive).
  - `POST /{id}/issue-download-token` + `GET /download/{token}` — one-time redemption for >50 MB files.
- `backend/app/services/crypto_shred.py` — `shred_subject`, `shred_document`; destroys subject KEK version and flags docs.
- `backend/app/services/deletion_service.py` — two-person approval now calls `shred_document` for `entity_type == "documents"`.
- `SubjectKEKVersion` model + `derive_subject_dek()` in `core/crypto.py` — version-bumped HKDF info makes old ciphertexts unrecoverable.

### Messaging + break-glass (2.7, 2.8)
- `backend/app/services/message_crypto.py` — per-conversation DEK, AAD = conv_id|sender|msg_id.
- Model changes: `conversations.dek_key_id + dek_rotated_at`; `communications.body_ciphertext` + `body` nullable.
- `backend/app/models/break_glass_request.py` + `/api/v1/compliance/break-glass` routes — request / approve / reject / list.  Approver issues a scoped JWT (`purpose=break_glass`, 30-min TTL) with resource ids + justification.

### Auth (2.9, 2.10, 2.11, 2.12)
- `backend/app/services/webauthn_service.py` + `/api/v1/webauthn/*` — py_webauthn 2.x registration + authentication; challenges in Redis with 5-min TTL; sign-count verified.
- `create_step_up_token` + `create_break_glass_token` in `core/security.py`.
- `require_step_up(action)` and `require_break_glass(action)` deps in `app/api/deps.py`.
- `POST /auth/step-up` mints a 5-min token after password or TOTP re-auth.
- Step-up applied to: `mfa/disable`, `/export/{resource}`, `/compliance/export/me`, `/compliance/erasure/{id}/approve`, `/files/{id}/stream-gated`.
- `refresh_tokens.last_active_at` + sliding 30-min idle check; expired family revoked.

### Compliance (2.13, 2.14, 2.15)
- `/api/v1/compliance/export/me` — GDPR Art. 20 JSON bundle (user + profile + messages + documents + consents).
- `ErasureRequest` model + `/api/v1/compliance/erasure/*` — two-person approval + step-up; approval runs `shred_subject`.
- `ConsentLog` model + `/api/v1/compliance/consent/{grant,revoke,history}` — every action captured in audit chain.

### Infrastructure
- `alembic/versions/phase2_merge_heads.py` — merges the two Phase 1 heads.
- `alembic/versions/phase2_schema.py` — all new columns + tables in one migration (idle timeout, envelope-encryption metadata, conversation DEK version, webauthn, break-glass, erasure, consent, download tokens, subject_kek_versions).
- `AuditAction` extended with 20 new Phase 2 enum values.

## What is deliberately NOT in this PR

- **Break-glass approval UI / compliance dashboard**: backend routes are stable; frontend dashboards are still to come.
- **Document backfill execution**: the backfill *script* now exists at `scripts/backfill_encrypted_documents.py` but has not been run against production.  `/api/v1/documents/upload` still writes plaintext for callers that haven't migrated to `/api/v1/files/upload`.

## Follow-up wiring completed 2026-04-20

- **Message encryption wired end-to-end**: `communication_service.send_message` now calls `encrypt_body`, stores ciphertext in `communications.body_ciphertext`, and bumps `conversations.dek_key_id` on first message.  `get_messages_for_conversation`, `get_pending_reviews`, `get_communications_by_approval_status`, `submit_for_review`, and `review_communication` all decrypt through a detach-then-mutate helper (`_attach_plaintext_body`) so the plaintext never flushes back to the DB.  Legacy plaintext rows still deserialise correctly because `body` is nullable and decryption is skipped when `body_ciphertext is None`.
- **Step-up sweep**: `view_pii` now gates `GET /clients/{id}` and `GET /intake/{id}/draft`; `user_delete` gates `DELETE /users/{id}`; `user_disable` gates `POST /users/{id}/deactivate`.  The `http_exception_handler` was updated to hoist `error` / `action` / `action_scope` markers to the top of the JSON body so browser interceptors don't have to parse a nested `detail` key.
- **Backfill script**: `scripts/backfill_encrypted_documents.py` iterates `documents` rows with `kek_version IS NULL`, fetches plaintext from MinIO, re-uploads through `storage_service.upload_encrypted_bytes`, updates the row's envelope metadata, and deletes the legacy object.  Idempotent (`--dry-run` supported); run against production DB via the usual `DATABASE_URL` public-proxy override.
- **Frontend step-up modal**: `components/auth/step-up-modal.tsx` + `stores/step-up.ts` + an interceptor in `lib/api.ts` now detects 401 `step_up_required`, prompts the user to re-auth with password or TOTP, caches the resulting token in-memory keyed by action, and transparently retries the original request with `X-Step-Up-Token`.
- **Frontend WebAuthn**: `@simplewebauthn/browser` drives `components/auth/passkeys-card.tsx` which was added to all three security settings pages (dashboard, portal, partner).  Users can register, list, and revoke device passkeys.  `lib/api/webauthn.ts` also exports `authenticateWithPasskey(email)` for a future passwordless sign-in screen.

## Operational config

Production must set (or confirm defaults):

```
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
CLAMAV_FAIL_OPEN=false

WEBAUTHN_RP_ID=amg-portal.com
WEBAUTHN_RP_NAME=AMG Portal
WEBAUTHN_ORIGINS=["https://amg-portal.com","https://backend.amg-portal.com"]

STEP_UP_TOKEN_EXPIRE_MINUTES=5
BREAK_GLASS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_IDLE_TIMEOUT_MINUTES=30
DOWNLOAD_TOKEN_TTL_SECONDS=120
DOWNLOAD_PROXY_THRESHOLD_BYTES=52428800
OBJECT_LOCK_KYC_YEARS=7
OBJECT_LOCK_CONTRACT_YEARS=7
```

Phase 1 KEK/HMAC/Ed25519 env vars are reused unchanged.

## Verification

- `ruff check` passes.
- `mypy --strict` passes (407 files).
- Migrations merge to a single head (`phase2_schema`).

## Remaining follow-up items

1. Extend `require_step_up` coverage to any remaining wire-approve / program-delete endpoints once finance routes (`partner_payments.py`, `invoices.py`) are spec'd for step-up.
2. Passwordless sign-in flow on the login page — the `authenticateWithPasskey(email)` client is already in `lib/api/webauthn.ts`; just needs a "Sign in with a passkey" button wired to it.
3. Run `scripts/backfill_encrypted_documents.py` against production under a maintenance window (`--dry-run` first); until then legacy plaintext objects remain in MinIO.
4. Break-glass approval dashboard UI (backend routes in `/api/v1/compliance/break-glass`).
5. `.well-known/audit-key.pem` already served by frontend (Phase 1.16); confirm integration tests post-merge.
