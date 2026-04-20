# Phase 1 — Encryption Foundations + Audit Chain

**Source:** `docs/security-plan.md` §6 Phase 1 (items 1.1–1.16)
**Target duration:** 4–6 weeks
**Draft:** 2026-04-20

Every item below is grounded in (a) the existing codebase as it stands today and (b) a real-world reference implementation found via `mcp__grep__searchGitHub`. We are not inventing anything new; we are gluing known-good patterns onto the existing AMG stack.

---

## 0. Ground-state audit (what Phase 0 already landed)

Verified before planning. None of these are to-do:

| Phase 0 item | Status | Where |
|---|---|---|
| 0.1 CSRF double-submit middleware | Done | `backend/app/middleware/csrf.py` (HMAC-bound to `sub`/`jti`; `__Host-csrf` cookie) |
| 0.2 `__Host-` prefixed auth + CSRF cookies | Done | `backend/app/api/v1/auth.py:108-167` |
| 0.5 `/register` email-enum fix (always 202) | Done | `backend/app/api/v1/auth.py:240-302` |
| 0.10 `MFA_EXEMPT_EMAILS` gated on `DEBUG=False` | Done | `backend/app/core/config.py:161` |
| RLS DDL (policies exist, wiring incomplete) | Partial | `alembic/versions/add_rls_policies.py`; `apply_rls_context` helper in `db/session.py` used only through explicit `with_rls` dep, not `after_begin` |
| MFA secret Fernet-encrypted | Done | `encrypt_mfa_secret` / `decrypt_mfa_secret` in `core/security.py` — template for Phase 1.3 |
| Audit log append-only w/ after-flush listener | Done | `core/audit_listener.py`; `models/audit_log.py` |

Implication for Phase 1: we are extending an already-solid scaffolding, not starting from zero. The MFA-Fernet pattern is the on-ramp for the broader `CryptoProvider` migration.

---

## 1. Design invariants

These lock before any code is written. They are forcing-functions for every concrete decision below.

1. **Every new ciphertext stores its key-id.** Lazy rotation — no bulk re-encrypt — requires per-cell provenance. Absent the key-id byte, rotation is a migration event.
2. **Every new ciphertext carries AAD.** AAD = `f"{table}|{column}|{pk_uuid}"`. Prevents ciphertext substitution attacks and makes the encrypted value provably tied to its row/column.
3. **Keys live in env vars (Day 1).** `CryptoProvider` protocol makes swapping to Vault OSS a one-line wiring change later. Don't jump ahead to Vault.
4. **Old values keep decrypting under old keys.** Decrypt path consults header byte; encrypt path always uses `CURRENT_KEK_ID`. A KEK rotation is just `set CURRENT_KEK_ID=2; add AMG_KEK_V2=...` + deploy.
5. **No plaintext presence tests on encrypted columns.** Any `LIKE` / prefix / range over tax_id, passport etc. is replaced by blind-index equality lookup or removed entirely.
6. **Audit chain is write-once, verify-anywhere.** Third parties can verify our daily-signed Merkle root against a published Ed25519 pubkey without any AMG dependency.
7. **All crypto work uses `pyca/cryptography`'s AESGCM + HKDF + Ed25519 primitives.** No hand-rolled CBC, no Fernet for new fields (Fernet lacks AAD + key-id + versioning — acceptable only for legacy MFA).
8. **Don't add error handling that hides a real problem.** Decryption failure of a field that *was* populated must raise and alert — never silently return `None`.

---

## 2. Reference implementations (from Grep-MCP research)

Pattern → repo file we are copying/adapting from:

| Concern | Reference | Note |
|---|---|---|
| `TypeDecorator` w/ `LargeBinary` + `cache_ok=True` | `aipotheosis-labs/aci` → `backend/aci/common/db/custom_sql_types.py` | Modern SQLA 2 idiom; `cache_ok=True` keeps statement cache working (the bug that killed `sqlalchemy_utils.EncryptedType`) |
| HKDF-SHA256 envelope | `strongswan/strongMan` → `strongMan/helper_apps/encryption/fields.py` | `HKDF(salt=b'', info=nonce+domain_sep)` — domain-separation via `info` |
| HKDF with domain separator info | `apidoorman/doorman` → `backend-services/utils/memory_dump_util.py` | `info=b'doorman-mem-dump-v1'` style |
| `EncryptedBinary` TypeDecorator prior art | `bitcoinlib` → `bitcoinlib/db.py` | Key-material loading + `impl = LargeBinary` |
| Argon2id + bcrypt lazy migration | `darthnorse/dockmon` → `backend/auth/v2_routes.py` | **Explicit** argon2 → fall back to bcrypt → rehash — our blueprint for 1.6 |
| `check_needs_rehash` idiom | `markbeep/AudioBookRequest` → `app/internal/auth/authentication.py` | Clean inline rehash after successful verify |
| HIBP k-anonymity (sync) | `getsentry/sentry` → `src/sentry/auth/password_validation.py` | Canonical Python HIBP impl |
| HIBP k-anonymity (async) | `home-assistant/supervisor` → `supervisor/utils/pwned.py` | aiohttp-based; closer to our FastAPI stack |
| SQLA `Session.after_begin` event | `podly-pure-podcasts` → `src/app/__init__.py` | Exact signature we need for 1.11 |
| Whitelist dict sort helper | `ParisNeo/lollms_hub` → `app/crud/log_crud.py` | `allowed_sort_columns.get(key, default)` idiom |
| `Annotated[str, StringConstraints(max_length=...)]` aliases | `tenable/pyTenable` → `tenable/io/sync/models/common.py` | Reusable `str16`/`str32`/`str64` aliases — perfect for schema-wide audit |
| Ed25519 sign/verify | `IBM/mcp-context-forge` → `mcpgateway/utils/validate_signature.py` | PEM-loaded private key + `.sign(data).hex()` |
| Ed25519 `from_private_bytes` + `.sign` | `GoogleCloudPlatform/python-docs-samples` → `media_cdn/snippets.py` | Raw-bytes loader for env-var storage |
| RFC 3161 TSA client | `trbs/rfc3161ng` on PyPI | Only well-maintained pure-Python RFC 3161 client |
| FreeTSA endpoint | TSA preset lists across sigstore/cosign, Stirling-PDF, LibreSign | `https://freetsa.org/tsr` |

Each concrete step below links back to the repo it was lifted from.

---

## 3. Ordering + dependency graph

Items must land in dependency order. This graph is the sprint plan.

```
 1.1 CryptoProvider
  │
  ├─► 1.2 EncryptedBytes TypeDecorator
  │    │
  │    ├─► 1.3 Low-hanging fruit (OAuth tokens, SMTP, DocuSign key)
  │    ├─► 1.4 Client high-sensitivity columns + backfill
  │    │    │
  │    │    └─► 1.5 Blind indexes (tax_id, passport)
  │    └─► (Phase 2 picks up: messaging, files)
  │
  └─► 1.12 Audit-chain columns (needs HMAC key, ties to CryptoProvider)
        │
        ├─► 1.13 Daily Merkle + Ed25519 + FreeTSA
        ├─► 1.14 Daily verification cron
        ├─► 1.15 Role separation (app role UPDATE/DELETE revoke)
        └─► 1.16 .well-known pubkey publication

 1.6 Argon2id — independent, any time
 1.7 HIBP — depends on 1.6 being in place so the hashing path is in one module
 1.8 Cost-weighted rate limits — independent, extends existing limiter
 1.9 Safe sort helper — independent, audit sweep
 1.10 Pydantic max_length audit — independent, schema sweep
 1.11 RLS after_begin wiring — needs policy DDL that already landed
```

**Concrete sprint buckets:**

- **Week 1–2 (unblock everything):** 1.1, 1.2, 1.6, 1.7, 1.9, 1.10
- **Week 3–4 (encrypt what's on fire):** 1.3, 1.4, 1.5, 1.11, 1.8
- **Week 4–6 (audit chain becomes a product feature):** 1.12, 1.13, 1.14, 1.15, 1.16

---

## 4. Per-item implementation spec

Every item lists: files, wire format / signature, migration plan, test plan, and a "don't" list to prevent scope-creep.

### 1.1 CryptoProvider protocol + EnvKey impl + HKDF per-tenant DEKs

**New files:**
- `backend/app/core/crypto.py` — `CryptoProvider` Protocol, `EnvKeyCryptoProvider` class, module-level `get_crypto()` accessor, `derive_dek()` helper.
- `backend/tests/core/test_crypto.py`

**Env vars (new in `core/config.py`):**
```
AMG_KEK_V1            # 32-byte urlsafe-b64; required in production
AMG_KEK_V2..N         # optional additional versions
CURRENT_KEK_ID: int = 1
AMG_BIDX_KEY_V1       # 32-byte urlsafe-b64; separate from KEK per D2
```

Config gating mirrors `MFA_ENCRYPTION_KEY`: required when `DEBUG=False`, derived from `SECRET_KEY` + `hkdf(info=b"amg|kek|v1")` when `DEBUG=True` so local dev doesn't need real secrets.

**Signatures (locked):**
```python
class CryptoProvider(Protocol):
    def unwrap_kek(self, key_id: int) -> bytes: ...
    def derive_dek(self, kek: bytes, tenant_id: UUID, column: str) -> bytes: ...
    @property
    def current_kek_id(self) -> int: ...

class EnvKeyCryptoProvider:
    def __init__(self, keys: dict[int, bytes], current: int): ...
    # HKDF(SHA-256, kek, info=f"amg|tenant|{tenant_uuid}|col|{col}".encode())
```

**Pattern source:** HKDF usage from `apidoorman/doorman`; `info` domain-separator pattern from `strongMan`.

**Tests:**
- Round-trip: encrypt with v1, rotate to v2, old ciphertext still decrypts, new writes use v2.
- HKDF determinism: same `(tenant_id, column)` produces same DEK; flipping either input produces a different DEK.
- Missing KEK id in header → raises `UnknownKeyVersion`, not silent None.
- Production startup fails fast if `AMG_KEK_V{CURRENT_KEK_ID}` missing.

**Don't:**
- Don't build Vault integration — `VaultCryptoProvider` is Phase-future. Leave a TODO comment pointing to the Protocol.
- Don't cache derived DEKs in the module — HKDF is ~1µs; caching adds a lifetime-management problem (zeroisation, eviction) for no real win.
- Don't store DEKs in the DB — whole point of HKDF-on-the-fly is "no DEK storage."

---

### 1.2 `EncryptedBytes` SQLAlchemy TypeDecorator

**New file:** `backend/app/db/encrypted_type.py`

**Wire format (header + body):**
```
byte  offset  field
  0     0     version (currently 0x01)
  1     1     key_id  (1..255)
  2-13 12     nonce (random per encryption)
 14+  var     ciphertext || 16-byte GCM tag
```

AAD = `f"{table}|{column}|{pk_uuid}".encode("utf-8")`. AAD is computed from `context.current_parameters` during `process_bind_param` — **not** stored in the DB (reconstructed at decrypt time from the row's natural location).

**Pattern source:** `aipotheosis-labs/aci/backend/aci/common/db/custom_sql_types.py` for the `TypeDecorator[bytes]` with `cache_ok = True` and `impl = LargeBinary`.

**Skeleton:**
```python
class EncryptedBytes(TypeDecorator[bytes]):
    impl = LargeBinary
    cache_ok = True  # <-- critical; what killed sqlalchemy_utils.EncryptedType

    def __init__(self, *, table: str, column: str) -> None:
        super().__init__()
        self._table = table
        self._column = column

    def process_bind_param(self, value, dialect):
        if value is None: return None
        tenant, pk = _resolve_aad_context(...)
        aad = f"{self._table}|{self._column}|{pk}".encode()
        crypto = get_crypto()
        kek = crypto.unwrap_kek(crypto.current_kek_id)
        dek = crypto.derive_dek(kek, tenant, self._column)
        nonce = os.urandom(12)
        ct = AESGCM(dek).encrypt(nonce, value, aad)
        return bytes([0x01, crypto.current_kek_id]) + nonce + ct

    def process_result_value(self, value, dialect):
        if value is None: return None
        version, key_id = value[0], value[1]
        if version != 0x01: raise UnsupportedCiphertextVersion(version)
        nonce, body = value[2:14], value[14:]
        ...
```

**Open question — AAD binding:** `process_bind_param` does not natively get the row's PK. Two resolutions, pick one:
- **Option A (chosen):** make the column's model class expose `__aad_pk_for_encrypt__(self)` returning the AAD string; set it from a SQLA `before_insert` / `before_update` event that stashes the PK in a context-local var the `TypeDecorator` reads. This is analogous to how `audit_context_var` is read by `audit_listener.py:257`.
- Option B: compute AAD only from `table|column` and omit PK. Weaker integrity (row-swap attacks possible) but simpler.

Going with Option A — the audit listener already proves the context-var pattern works cleanly in this codebase.

**Tests:**
- Round-trip with non-None value.
- `None` round-trips as `None`.
- Wrong AAD (simulate row-swap by moving ciphertext bytes between rows in raw SQL) fails auth-tag verification.
- Tampering any byte of the header or body fails verification.
- `cache_ok=True` verified via `dialect.statement_compiler` test — compiled SQL is identical across two queries that differ only in literal values.

**Don't:**
- Don't use `sqlalchemy_utils.EncryptedType`. The plan explicitly says so; `cache_ok=False` in that library is the exact footgun.
- Don't support multiple cipher versions yet — 0x01 is the only one. Versioning is for the future, not Day 1 complexity.
- Don't encrypt `None` as a marker — `NULL` stays `NULL` so indexes (blind-index sidecars) still work.

---

### 1.3 Low-hanging fruit: OAuth / SMTP / DocuSign

Migrate existing plaintext secrets to `EncryptedBytes`. No UX changes, just ciphertext-at-rest. This is a warm-up for 1.4 and proves the `EncryptedBytes` infra works end-to-end.

**Files touched:**
- `backend/app/models/user.py` — change `google_calendar_token: dict → EncryptedBytes` (same for `outlook_calendar_token`). Serialize dict → `json.dumps(...).encode()` in application code when writing; decode on read. Keep the `JSON` Python typing via a wrapper `TypeDecorator` `EncryptedJSON` that composes `EncryptedBytes` with JSON (de)serialization.
- `backend/app/services/calendar_service.py` — wrapper functions to set/get the (now binary) tokens.
- `backend/app/core/config.py` — `DOCUSIGN_PRIVATE_KEY` stays an env var (it's a master key, not a per-row value); what we encrypt is any DB-resident copy of the DocuSign per-user credential (if any — check `alembic/versions/docusign0001_add_docusign_columns.py` for which tables carry DocuSign state).
- SMTP password is already `SMTP_PASSWORD` env var — no at-rest storage to encrypt there. **Dropped from this phase**; the plan's original listing conflated env + DB.

**Alembic migration:** `encrypt_user_calendar_tokens.py` — iterates existing rows, runs each value through `EncryptedBytes.process_bind_param` (via a bound Session), writes back. Pattern: `encrypt_mfa_secrets_at_rest.py` (already in repo).

**Tests:**
- After migration, raw DB column is binary; through the ORM, values round-trip as dicts.
- Existing calendar-refresh worker continues to function (token refresh writes a new dict; read-encrypt-write must produce a valid new ciphertext).
- Decrypting a row with a missing KEK fails loudly.

**Don't:**
- Don't keep a plaintext "legacy" column as a fallback. Delete or migrate; no ambiguity.
- Don't assume env-var secrets need to be wrapped in `EncryptedBytes` — env = out of scope for DB encryption.

---

### 1.4 Client high-sensitivity column encryption + backfill

**Files touched:**
- `backend/app/models/client_profile.py:24` — `tax_id: str | None` becomes `tax_id: bytes | None` with `EncryptedBytes(table="client_profiles", column="tax_id")`.
- Same for: `address` (L30), and new columns if needed for `passport`, `national_id`, `net_worth`, `banking_details`, `beneficiary_info`, `kyc_extracts`. Many of these are not in the current schema (no `net_worth` column today). **Scope-check before migration:** confirm which columns actually exist and which are speculative in the plan doc.
- `backend/app/schemas/client_profile.py` — stays `str` on the wire; conversion happens in the ORM/TypeDecorator boundary.
- `backend/app/api/v1/clients.py` — audit every `Client.tax_id == something` query; convert to blind-index lookup (see 1.5).

**Alembic migration — strategy:**

Two-phase to avoid downtime:
1. Add `tax_id_enc BYTEA`, `tax_id_bidx BYTEA(16)` columns *alongside* the existing plaintext.
2. Backfill in batches: `UPDATE client_profiles SET tax_id_enc = <encrypt>, tax_id_bidx = <hmac> WHERE id IN (...)`.
3. Deploy new code that reads/writes `tax_id_enc` and falls back to `tax_id` on read if `tax_id_enc IS NULL`.
4. Second migration: after one full deploy and verification, drop the plaintext column.

**Why two migrations:** a single-migration cutover is safer only if the DB fits in a transaction-safe backfill window. For `client_profiles` (UHNW client count is small — hundreds, not millions) one migration is acceptable. Default: **single migration**; flag if row count > 10k at run time.

**Tests:**
- Insert → select round-trips plaintext through ORM.
- Raw `SELECT tax_id FROM client_profiles` returns binary bytes.
- Backfill idempotency: re-running the migration on already-encrypted rows does not double-encrypt (detect via version-byte header).
- Backfill failure mid-batch: rerun continues from where it left off.

**Don't:**
- Don't encrypt `legal_name`, `primary_email`, `display_name`. They're required for login/search; encrypting them breaks the app.
- Don't change Pydantic schema types — API contract stays `str`.
- Don't encrypt `created_at` / FKs / `approval_status`.

---

### 1.5 Blind indexes for equality lookup

**New columns (per encrypted column with equality lookup):**
- `tax_id_bidx BYTEA(16)` + B-tree index.
- `passport_bidx BYTEA(16)` + B-tree index.

**Derivation (in `core/crypto.py`):**
```python
def blind_index(key: bytes, value: str) -> bytes:
    normalized = unicodedata.normalize("NFKC", value).strip().lower()
    return hmac.new(key, normalized.encode("utf-8"), sha256).digest()[:16]
```

**Normalization is a contract** — must be byte-identical on write and on query. Put it in `core/crypto.py` so there is exactly one implementation.

**Call sites to update:** anywhere the code does `.where(Client.tax_id == x)` — convert to `.where(Client.tax_id_bidx == blind_index(bidx_key, x))`. Grep the repo for `tax_id ==` / `passport ==` and audit each.

**Tests:**
- Same normalized input → same bidx (determinism).
- Different keys → different bidx (key-dependent).
- NFKC/case normalization catches `"123-45-6789"` vs `" 123-45-6789 "` vs `"123-45-6789"` (width variants).
- No prefix / range / LIKE test — proves the helper is equality-only.

**Don't:**
- Don't allow prefix searches via blind index. That leaks.
- Don't rotate `AMG_BIDX_KEY` casually — requires full recompute of every bidx column. Treat as a planned maintenance event.
- Don't expose the bidx column through any API response or serializer.

---

### 1.6 Argon2id password hashing + lazy migration from bcrypt

**Files touched:**
- `backend/app/core/security.py:124-129` — `hash_password` / `verify_password` rewritten.

**Blueprint:** `darthnorse/dockmon/backend/auth/v2_routes.py` + `markbeep/AudioBookRequest/app/internal/auth/authentication.py`.

**New impl:**
```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

_ph = PasswordHasher(time_cost=2, memory_cost=47104, parallelism=1)

def hash_password(password: str) -> str:
    return _ph.hash(password)

def verify_password(plain: str, stored: str) -> tuple[bool, bool]:
    """Returns (is_valid, needs_rehash)."""
    # Argon2 hashes start with $argon2id$
    if stored.startswith("$argon2"):
        try:
            _ph.verify(stored, plain)
            return True, _ph.check_needs_rehash(stored)
        except (VerifyMismatchError, InvalidHashError):
            return False, False
    # Fall back to bcrypt for legacy rows; successful verify triggers rehash
    try:
        ok = bcrypt.checkpw(plain.encode(), stored.encode())
        return ok, ok  # always rehash a successful bcrypt verify
    except ValueError:
        return False, False
```

**Call-site changes:**
- `auth.py:310` `login` flow — after successful verify, if `needs_rehash`, write `user.hashed_password = hash_password(plain)` and commit. Do this inside the same transaction; it's a fire-and-forget silent upgrade.
- `auth.py:502` `change_password`, `auth.py:602` `reset_password` — no change (new writes always use argon2).

**Tests:**
- Bcrypt hash + correct pw → `(True, True)` — then re-login and confirm stored hash now starts with `$argon2id$`.
- Argon2 hash + correct pw → `(True, False)`.
- Bumping `memory_cost` in the module constant → existing argon2 hashes return `needs_rehash=True`.
- Wrong password for both algorithms → `(False, False)`.
- Malformed stored hash doesn't crash login.

**Don't:**
- Don't remove `bcrypt` from requirements — legacy verify path still needs it for months.
- Don't require users to reset passwords on their next login — silent upgrade, no UX.
- Don't use `argon2.low_level`; `PasswordHasher` is the supported interface.

---

### 1.7 HIBP k-anonymity check

**New file:** `backend/app/services/hibp.py`

**Blueprint:** `home-assistant/supervisor/supervisor/utils/pwned.py` (async aiohttp — closest to our FastAPI stack) + `getsentry/sentry/src/sentry/auth/password_validation.py` (canonical error semantics).

**Impl:**
```python
import hashlib
import httpx
from app.core.exceptions import BadRequestException

_HIBP_URL = "https://api.pwnedpasswords.com/range/{prefix}"
_THRESHOLD = 1  # reject if seen ≥1 times
_TIMEOUT = httpx.Timeout(5.0, connect=2.0)

async def check_password_pwned(password: str) -> int:
    """Return the breach count; 0 if not found. Network error → 0 (fail-open)."""
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(_HIBP_URL.format(prefix=prefix),
                             headers={"User-Agent": "AMG-Portal"})
            r.raise_for_status()
    except httpx.HTTPError:
        return 0  # deliberate: don't block account creation on HIBP outage
    for line in r.text.splitlines():
        sfx, count = line.split(":", 1)
        if sfx == suffix:
            return int(count)
    return 0

async def enforce_not_pwned(password: str) -> None:
    count = await check_password_pwned(password)
    if count >= _THRESHOLD:
        raise BadRequestException(
            "This password has appeared in a public data breach. "
            "Choose a different password.",
        )
```

**Wire into:** `auth.py` — `register` (post-`UserCreate` validation), `change_password`, `reset_password`, `mfa_setup` is not password-bound (skip).

**Tests:**
- SHA1 of "hiphophouse" matches Sentry's test fixture (high-count) → rejected.
- Unknown password → allowed.
- httpx timeout → fail-open (doesn't DoS registration).
- TTL cache (optional, 6h) to cut HIBP call volume; keep it simple for now — add only if metrics demand it.

**Don't:**
- Don't fail-closed on HIBP outage. Better to accept a breached password occasionally than block every registration when HIBP is down.
- Don't hit `haveibeenpwned.com/api/v3/*` — that's the breach API and requires a paid API key. We only need the free range API.
- Don't log the full SHA1 (leaks password candidate by brute force); log the prefix only.

---

### 1.8 Per-role / cost-weighted rate limits

**Files touched:**
- `backend/app/core/rate_limit.py:97` — extend `RateLimiter` to accept `cost: int = 1` and resolve user identity into the bucket key.

**New class:**
```python
class RateLimiter:
    def __init__(self, action: str,
                 *,
                 anon: int,
                 authed: int,
                 admin: int | None = None,
                 window: int = 60,
                 cost: int = 1):
        ...
    async def __call__(self, request: Request,
                       current_user: User | None = Depends(get_optional_user)): ...
```

Bucket key: `rate_limit:{action}:{role_bucket}:{ip_or_user_id}`. For authenticated callers, use `user_id` (stable across IP changes); for anons, use IP.

**Cost-weighted:** the sliding-window ZSET stores `cost` copies of the current timestamp (or uses `ZADD` with `cost` integer score — simpler to stay with current design and just loop `zadd` `cost` times). Heavy endpoints (PDF gen, bulk export, email send) declare `cost=5` or similar.

**Config (new in `config.py`):**
```
RATE_LIMIT_TIERS: dict[str, dict[str, int]] = {
    "login":            {"anon": 5,  "authed": 20,  "admin": 100},
    "export_pdf":       {"anon": 0,  "authed": 5,   "admin": 20 },
    "bulk_email":       {"anon": 0,  "authed": 3,   "admin": 30 },
    ...
}
```

**Tests:**
- Anon under anon-limit → allowed; anon-over → 429.
- Same endpoint as admin → higher limit applies.
- `cost=5` endpoint fills the bucket 5× faster.
- Redis down → in-process fallback still applies tiers (existing behaviour, don't regress).

**Don't:**
- Don't drop the IP fallback key for anons — it's what stops distributed stuffing.
- Don't implement leaky-bucket or token-bucket; the existing sliding window is fine and battle-tested.
- Don't add per-user penalty boxes in this phase — 429 + Retry-After is enough.

---

### 1.9 Safe dynamic-sort helper

**New file:** `backend/app/utils/sort.py`

**Blueprint:** `ParisNeo/lollms_hub/app/crud/log_crud.py` (`allowed_sort_columns.get(...)` idiom).

**Signature:**
```python
def safe_order_by(
    stmt: Select,
    sort_by: str | None,
    sort_dir: str | None,
    *,
    whitelist: dict[str, InstrumentedAttribute],
    default: InstrumentedAttribute,
) -> Select:
    column = whitelist.get(sort_by or "", default)
    direction = asc if (sort_dir or "asc").lower() != "desc" else desc
    return stmt.order_by(direction(column))
```

**Audit sweep:** grep for `order_by(` + any string-interpolated column. Expected locations from a quick scan: any list endpoint in `api/v1/*` that takes `sort_by` query param. Replace each with `safe_order_by`.

**Tests:**
- Unknown `sort_by` → default applied, no exception.
- `sort_dir="desc"` → descending; anything else → ascending (default-safe).
- Injection attempt (`sort_by="id; DROP TABLE users"`) → falls through to default.

**Don't:**
- Don't let routes accept raw SQL fragments. Whitelist = InstrumentedAttribute, never string.
- Don't support multi-column sort in this phase. Scope creep.

---

### 1.10 Pydantic `max_length` audit

**Blueprint:** `tenable/pyTenable/tenable/io/sync/models/common.py` — reusable `Annotated` type aliases.

**New file:** `backend/app/schemas/base.py` — shared short/medium/long string aliases.

```python
from typing import Annotated
from pydantic import StringConstraints

Str50   = Annotated[str, StringConstraints(max_length=50,   strip_whitespace=True)]
Str100  = Annotated[str, StringConstraints(max_length=100,  strip_whitespace=True)]
Str255  = Annotated[str, StringConstraints(max_length=255,  strip_whitespace=True)]
Str500  = Annotated[str, StringConstraints(max_length=500,  strip_whitespace=True)]
Str2000 = Annotated[str, StringConstraints(max_length=2000, strip_whitespace=True)]
TextStr = Annotated[str, StringConstraints(max_length=10_000)]
```

**Sweep:** `backend/app/schemas/*.py` — every `str` field gets one of the aliases above. Decision heuristic:
- Name/email/short label → `Str255`.
- Phone / short enum → `Str50`.
- URL / long label → `Str500`.
- Notes / description → `Str2000` or `TextStr`.

This is intentionally mechanical — a PR that's large in LOC but each hunk is trivial.

**Also:** global JSON body-size limit goes into `main.py` via `content-size-limit-asgi` (Phase 0.6 in the original plan, listed there but worth re-confirming landed; if not, land here).

**Tests:**
- Each schema module's `test_*_schema.py` gets one "reject oversized" assertion per newly-constrained field. Keep the test additions lean: one negative per schema file is enough to trip a regression.

**Don't:**
- Don't change wire types (keep `str`).
- Don't widen an existing model constraint "just in case" — keep current caps.

---

### 1.11 Postgres RLS wiring: `after_begin` event + `RESET ALL` on checkin

The *policies* already exist (`alembic/versions/add_rls_policies.py`); the *session-level variables* are only being set when a route explicitly uses `with_rls` dep. That's today's hazard: a checkout from the pool that was last used with `SET LOCAL app.current_user_id = '<tenant-A-uuid>'` will leak across tenants.

**Blueprint:** `podly-pure-podcasts/src/app/__init__.py` — `@event.listens_for(Session, "after_begin")`.

**Files touched:**
- `backend/app/db/session.py` — add `after_begin` event listener + `reset` listener on the engine's pool `checkin`.
- `backend/app/api/deps.py:223` — delete `with_rls` and `RLSContext` once the event-based approach is wired (they become dead code).
- `backend/app/core/audit_context.py` — confirmed: user-id is already in a ContextVar; the `after_begin` listener reads from it.

**Wiring:**
```python
from sqlalchemy import event
from sqlalchemy.orm import Session as SyncSession
from app.core.audit_context import audit_context_var

@event.listens_for(SyncSession, "after_begin")
def _apply_rls(session, transaction, connection):
    ctx = audit_context_var.get()
    if ctx is None:
        return  # unauthenticated: RLS policies default-deny is fine
    connection.execute(
        text("SET LOCAL app.current_user_id = :uid"),
        {"uid": str(ctx.user_id)},
    )
    connection.execute(
        text("SET LOCAL app.current_user_role = :role"),
        {"role": str(ctx.user_role)},
    )

@event.listens_for(engine.sync_engine, "checkin")
def _reset_session_vars(dbapi_connection, connection_record):
    with dbapi_connection.cursor() as cur:
        cur.execute("RESET ALL")
```

**Wait — `AsyncSession` doesn't fire `after_begin` on the sync `Session` event directly.** The working approach is to listen on the `AsyncSession`'s underlying sync Session via `session.sync_session`, or to hook at `begin_transaction` on `AsyncConnection`. Need to prototype — the exact event name is an implementation detail, the *invariant* (set on begin, reset on checkin) is what we're after.

**Also:** `text("SET LOCAL ...")` with bind params — Postgres's `SET` *does not* accept `$n` parameters. Current code in `session.py:46` handles this by sanitising inputs; keep that sanitisation, just move the call site into the event listener. Do not introduce SQL injection by forgetting the sanitisation when relocating.

**Tests (critical — this is the RLS pool hazard):**
- Integration test: user A opens a tx, sets RLS; user B's tx on a returned connection from the pool cannot see user A's data. Assert `SELECT current_setting('app.current_user_id', true)` is empty at the start of user B's tx.
- Explicit `RESET ALL` on checkin verified by issuing back-to-back sessions and checking `current_setting(..., true)` is empty at the start of the second.
- `amg_app` role has `NO BYPASS RLS` (DB-level assertion).

**Don't:**
- Don't use connection-level `SET` (persists across checkouts). It must be `SET LOCAL`.
- Don't run migrations through `amg_app` — migrations need `BYPASS RLS`. Alembic connects as a separate `amg_migrator` role. Verify Railway env exposes both.

---

### 1.12 Audit-log chain columns + SQLA event on insert

**Files touched:**
- `backend/app/models/audit_log.py` — add `prev_hash`, `row_hash`, `hmac`, `day_bucket` columns.
- `backend/app/core/audit_listener.py` — extend the `after_flush` handler to compute hashes on new audit rows before they commit.
- Alembic migration: `add_audit_chain_columns.py`.

**New columns:**
```python
prev_hash:  Mapped[bytes | None] = mapped_column(LargeBinary(32), nullable=True)
row_hash:   Mapped[bytes]        = mapped_column(LargeBinary(32), nullable=False)
hmac:       Mapped[bytes]        = mapped_column(LargeBinary(32), nullable=False)
day_bucket: Mapped[date]         = mapped_column(Date, nullable=False, index=True)
```

**Computation (within the `after_flush` hook):**
```python
def _finalize_chain(session, entries: list[AuditLog]):
    prev = _last_row_hash(session)  # SELECT row_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1
    hmac_key = _daily_hmac_key(date.today())  # from env AUDIT_HMAC_KEY_YYYYMMDD
    for e in entries:
        e.prev_hash  = prev
        payload      = _canonical_json(e) + (prev or b"\x00" * 32)
        e.row_hash   = sha256(payload).digest()
        e.hmac       = hmac.new(hmac_key, e.row_hash, sha256).digest()
        e.day_bucket = date.today()
        prev = e.row_hash
```

Canonical JSON: sorted keys, separators `(",", ":")`, UTC ISO-8601, UUIDs as strings. Put in `core/audit_chain.py` so both insert + verify use the same function.

**Concurrency hazard:** two transactions flushing at once can both read the same `prev_hash`. Fix: compute the chain under `SELECT … FOR UPDATE` on an advisory-lock row (`pg_advisory_xact_lock(hashtext('audit_chain'))`). This serializes audit-row hashing across the cluster. Small hit (audit append is ~ms); worth it for chain integrity.

**Env vars:**
```
AUDIT_HMAC_KEY_YYYYMMDD   # 32-byte urlsafe-b64; one per UTC day
```

Rotation runbook: a daily APScheduler job generates tomorrow's HMAC key, persists it to Railway secrets via API (or pre-generates a rolling window of ~90 days up front and stores them in Railway).

**Tests:**
- Insert 3 audit entries → chain where `entry[i].prev_hash == entry[i-1].row_hash`.
- Tampering any column of a finalized row → recomputed `row_hash` ≠ stored → detection.
- Concurrent inserters produce a coherent chain (integration test under asyncio.gather).

**Don't:**
- Don't make the chain-break fatal at insert time in the same transaction — that turns every write into a brittle one. Log + alert out of band.
- Don't store the HMAC key in the DB.

---

### 1.13 Daily Merkle root + Ed25519 signature + FreeTSA anchor

**New files:**
- `backend/app/services/audit_chain.py` — chain job body.
- `backend/app/models/audit_checkpoint.py` — `audit_checkpoints(day, merkle_root, signature, tsa_token, created_at)`.
- Alembic migration for the table.

**Blueprint:**
- Ed25519: `IBM/mcp-context-forge/mcpgateway/utils/validate_signature.py` + `GoogleCloudPlatform/python-docs-samples/media_cdn/snippets.py`.
- RFC 3161: `trbs/rfc3161ng` (PyPI).
- FreeTSA endpoint: `https://freetsa.org/tsr`.

**Env vars:**
```
AUDIT_ED25519_PRIVATE_V1   # 32-byte raw private key, base64 — raw, not PEM, matches from_private_bytes
AUDIT_ED25519_PUBLIC_V1    # corresponding public key for .well-known publication (derivable, but stash both)
```

**Job body:**
```python
async def sign_daily_chain(target_day: date):
    rows = await db.execute(
        select(AuditLog.row_hash).where(AuditLog.day_bucket == target_day).order_by(AuditLog.created_at)
    )
    leaves = [r.row_hash for r in rows]
    if not leaves:
        return  # no audit activity today; nothing to sign
    root = _merkle_root(leaves)  # tree-hash: h(h(a)+h(b)) pairs, duplicate-last on odd count
    priv = ed25519.Ed25519PrivateKey.from_private_bytes(
        base64.b64decode(os.environ["AUDIT_ED25519_PRIVATE_V1"])
    )
    sig = priv.sign(root + target_day.isoformat().encode())
    tsa_token = await _freetsa_timestamp(root)  # rfc3161ng with https://freetsa.org/tsr
    db.add(AuditCheckpoint(day=target_day, merkle_root=root, signature=sig, tsa_token=tsa_token))
```

**APScheduler wiring:** add a daily job in `services/scheduler_service.py` at 00:05 UTC to sign yesterday's chain.

**FreeTSA fallback:** if FreeTSA is unreachable, retry every hour for 24h; beyond that, sign without TSA and flag the checkpoint row with `tsa_token IS NULL` and a `tsa_error` reason. Do not skip Ed25519 signing on TSA failure.

**Tests:**
- Signed → verifies against the derived public key.
- Tampered row in the chain → recomputed Merkle root ≠ signed root.
- FreeTSA mock returns bytes → persisted; mock failure → recorded with null token.

**Don't:**
- Don't put the Ed25519 private key in the DB. Env only.
- Don't use `rfc3161ng` synchronously inside a request handler; the sign job is async via APScheduler.
- Don't anchor to sigstore *and* FreeTSA — pick one (FreeTSA) for Day 1; sigstore is a fallback for if FreeTSA is persistently down.

---

### 1.14 Daily verification cron with alerting

**Files touched:** `backend/app/services/audit_chain.py` (add `verify_day` function).

**Logic:**
```python
async def verify_day(day: date) -> bool:
    # 1. Recompute row_hash per row from canonical JSON + prev_hash
    # 2. Recompute hmac from daily key
    # 3. Recompute Merkle root
    # 4. Verify stored Ed25519 signature over recomputed root
    # 5. Verify TSA token (if present) against the root bytes
    # any mismatch → log + send alert
```

**Alert channel:** existing email / in-portal notification pipeline. A tamper event is staff-visible within 24h.

**Scheduler:** 00:15 UTC daily (run after signing — verifies yesterday's chain plus re-verifies a random prior day for continuous assurance).

**Tests:**
- Happy path — verify returns True.
- Flip a byte in `before_state` → verify returns False, alert sent (assert via mocked email service).
- Missing checkpoint row → verify returns False.

**Don't:**
- Don't auto-quarantine or delete anything on detection. Tamper evidence → alert a human. Destroying suspect data destroys the investigation.

---

### 1.15 Revoke UPDATE/DELETE on `audit_logs` from app role

**New Alembic migration:** `restrict_audit_log_role_perms.py`.

**SQL:**
```sql
-- Create maintainer role (idempotent)
DO $$ BEGIN CREATE ROLE amg_audit_maintainer; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM amg_app;
GRANT  UPDATE, DELETE                ON audit_logs TO   amg_audit_maintainer;
-- App role keeps INSERT + SELECT.
```

**Railway ops requirement:** the `amg_audit_maintainer` login is only ever used by a maintenance script run by MD-level humans — not by the app. Document in `docs/security-runbooks/audit-log-maintenance.md`.

**Tests:**
- Integration test: `db.execute(text("DELETE FROM audit_logs"))` as `amg_app` → permission denied.
- Insert + select still work as `amg_app`.

**Don't:**
- Don't skip this on local dev. Even local should use the restricted role — catches broken seed scripts that try to `DELETE FROM audit_logs`.
- Don't grant `TRUNCATE` or `ALTER TABLE` to any non-DBA role.

---

### 1.16 Publish Ed25519 audit pubkey at `.well-known/audit-key.pem`

**Files touched:**
- `frontend/src/app/.well-known/audit-key.pem/route.ts` — Next.js route handler serving the PEM.
- OR alternatively: static file in `frontend/public/.well-known/audit-key.pem` (simpler, cache-friendly).

**Impl (static):** write PEM at deploy time from `AUDIT_ED25519_PUBLIC_V1` env var → baked into the build.

**Cache headers:** `Cache-Control: public, max-age=3600`. `Content-Type: application/x-pem-file`.

**Rotation plan:** publish current + previous at `.well-known/audit-key-v1.pem`, `.well-known/audit-key-v2.pem`, with `.well-known/audit-key.pem` pointing at current. Old signatures verify against their pinned key id.

**Tests:**
- `curl https://amg-portal.com/.well-known/audit-key.pem` returns 200, `application/x-pem-file`, valid PEM.
- The served pubkey verifies a checkpoint signature from the DB (end-to-end test).

**Don't:**
- Don't serve from the backend API — `.well-known/` is a convention that belongs on the primary domain (frontend in our Railway layout).
- Don't put the private key on the frontend build. Ever.

---

## 5. Cross-cutting: tests, docs, runbooks

- **Tests per item:** listed inline above. Target: 1.1–1.6 each add at least one integration test; 1.11 (RLS) and 1.12 (chain) each add end-to-end property-based tests.
- **Docs:** new runbooks under `docs/security-runbooks/` for: `key-rotation.md`, `audit-log-maintenance.md`, `rls-role-boundaries.md`. Write as a linear "when this happens, do these steps" script — not a tutorial.
- **Migration rollout:** every encrypted-column migration runs under an explicit batch size + resume checkpoint. Abort-then-resume must be idempotent (re-detection via version-byte).
- **Deployment order:** deploy code that *can read* new ciphertext but still falls back to plaintext → run migration → deploy code that *only* reads new ciphertext + drops fallback. Two deploys per batch.

---

## 6. Risks + mitigations

| Risk | Mitigation |
|---|---|
| A KEK leak at V1 time compromises every tax_id ever encrypted. | HKDF per-tenant DEKs limit blast radius to one tenant per compromised KEK. Rotate KEK on suspected leak; old data stays sealed by the compromised key, but new writes are clean. |
| Blind-index key rotation is a full recompute. | Lock `AMG_BIDX_KEY_V1` for a ≥5-year run. If rotation becomes required, plan as a week-long maintenance event. |
| RLS `after_begin` event doesn't fire for raw `AsyncEngine.execute`. | Prototype first; if the ORM-only guarantee is insufficient, add the `connect` / `checkout` pool event as belt-and-braces. Integration test asserts isolation either way. |
| FreeTSA outage breaks daily chain anchoring. | Store unsigned checkpoint, retry, alert after 24h. Do not block Ed25519 signature on TSA. |
| `argon2.check_needs_rehash` toggling mid-deploy → every login triggers a rehash. | Intentional — it's a silent upgrade, one per user per policy change. Rate limit by user isn't needed; bcrypt → argon2 happens once per account lifetime. |
| Audit-chain concurrency leaves gaps. | `pg_advisory_xact_lock` on `hashtext('audit_chain')` serialises chain append across the cluster. |
| Schema `max_length` change rejects legitimate long inputs. | During the sweep, sample existing DB values and pick caps at P99 + headroom. Don't pick smaller than current DB columns. |

---

## 7. Explicit non-goals

To prevent scope drift — these land in Phase 2 or later, **not now**:

- Client-side file envelope encryption (Phase 2.1) — we are leaving MinIO SSE-S3 alone in Phase 1.
- Messaging / conversation DEKs (Phase 2.7).
- WebAuthn / passkeys (Phase 2.9).
- Step-up auth (Phase 2.10–2.11).
- Data export / erasure endpoints (Phase 2.13–2.14).
- ClamAV integration (Phase 2.2).

If any of the above becomes tempting during Phase 1 work — write a note, don't write code.

---

## 8. Acceptance criteria

Phase 1 is done when:

1. `EncryptedBytes` TypeDecorator in use on at least `client_profile.tax_id`, both calendar OAuth token columns, and any DocuSign user credentials persisted in DB; blind indexes on `tax_id` + `passport` functional for equality queries.
2. Every new password hashed with argon2id; every successful bcrypt login produces an argon2 rewrite.
3. HIBP check on every password-set path; network failure is fail-open with structured logging.
4. Rate limits tiered per role, cost-weighted on heavy endpoints.
5. Every `order_by(user_input)` path routes through `safe_order_by`.
6. Every `str` field in `schemas/` has an explicit `max_length`.
7. RLS context set via `after_begin` and reset on `checkin`; integration test proves cross-tenant read returns nothing.
8. Audit rows carry `prev_hash`, `row_hash`, `hmac`, `day_bucket`; chain-break verification detects any byte-level tamper.
9. Daily Ed25519-signed Merkle root persisted with FreeTSA token; verification cron runs.
10. `amg_app` DB role cannot UPDATE/DELETE `audit_logs`.
11. `.well-known/audit-key.pem` serves the current Ed25519 public key.

Verifier: run `pytest backend/tests/` + `pytest backend/tests/integration/`, check RLS isolation test passes, `curl .well-known/audit-key.pem`, and flip one audit-log byte in dev to confirm detection.

---

*End of Phase 1 plan.*
