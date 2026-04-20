import base64
import hashlib
import os
import secrets
from datetime import date
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "AMG Portal"
    DEBUG: bool = False
    SQL_ECHO: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database — no password in default; set DATABASE_URL via env var or .env file.
    # Local dev: docker-compose.yml and backend/.env provide the full connection string.
    DATABASE_URL: str = "postgresql+asyncpg://postgres@localhost:5432/amg_portal"

    # Redis
    REDIS_URL: str = "redis://localhost:6380/0"

    # JWT
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # MinIO / S3 — credentials must be provided via env var or .env file.
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_SECURE: bool = False
    MINIO_BUCKET: str = "amg-portal"
    # Public-facing MinIO hostname for presigned URLs served to browsers.
    # When the backend runs inside Docker, MINIO_ENDPOINT is the internal service
    # name (e.g. "minio:9000") which is unreachable from browsers.  Set this to the
    # host-accessible address (e.g. "localhost:9000") so presigned URLs work.
    # Defaults to MINIO_ENDPOINT when not set.
    MINIO_PUBLIC_ENDPOINT: str | None = None

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Backend (for generating absolute URLs like calendar feed URLs)
    BACKEND_URL: str = "http://localhost:8000"

    # Cookie domain for auth cookies. In cross-origin deployments (separate
    # frontend/backend subdomains) set to the parent domain prefixed with a dot,
    # e.g. ".up.railway.app". None yields host-only cookies (fine for local dev).
    COOKIE_DOMAIN: str | None = None

    # MFA
    MFA_GRACE_PERIOD_DAYS: int = 7
    MFA_SETUP_TOKEN_EXPIRE_MINUTES: int = 30
    MFA_ENCRYPTION_KEY: str = ""  # Fernet key for encrypting MFA secrets at rest
    # Emails that are permanently exempt from MFA (e.g. demo accounts). JSON array string.
    MFA_EXEMPT_EMAILS: list[str] = []

    # Password Reset
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # Step-up auth (Phase 2.10) — short-lived scoped tokens for sensitive
    # actions (view PII, wire approve, program delete, MFA change, etc.).
    STEP_UP_TOKEN_EXPIRE_MINUTES: int = 5

    # Break-glass compliance access (Phase 2.8) — longer window because the
    # approval workflow is manual and we do not want staff to re-run approval
    # mid-session.  Every use emits an audit-chain row regardless of TTL.
    BREAK_GLASS_TOKEN_EXPIRE_MINUTES: int = 30

    # Idle timeout on refresh tokens (Phase 2.12).  ``None`` disables the
    # check; production should leave this at 30 min to match the plan.
    REFRESH_TOKEN_IDLE_TIMEOUT_MINUTES: int | None = 30

    # ClamAV (Phase 2.2).  ``CLAMAV_HOST`` empty disables scanning —
    # uploads skip the scan and the clam_result column is stamped
    # "disabled".  Production must set these.
    CLAMAV_HOST: str = ""
    CLAMAV_PORT: int = 3310
    CLAMAV_TIMEOUT_SECONDS: float = 30.0
    CLAMAV_FAIL_OPEN: bool = False  # When scanner unreachable: allow upload?

    # One-time-redemption download tokens (Phase 2.5).
    DOWNLOAD_TOKEN_TTL_SECONDS: int = 120
    DOWNLOAD_PROXY_THRESHOLD_BYTES: int = 50 * 1024 * 1024  # 50 MB — above this use redemption

    # Object Lock retention defaults per category (Phase 2.3).
    OBJECT_LOCK_KYC_YEARS: int = 7
    OBJECT_LOCK_CONTRACT_YEARS: int = 7
    OBJECT_LOCK_IR_EVIDENCE_YEARS: int = 10

    # WebAuthn / passkeys (Phase 2.9).  ``WEBAUTHN_RP_ID`` is the effective
    # domain (no scheme/port) that scopes credentials; ``WEBAUTHN_RP_NAME``
    # is the display name shown in browser prompts.  ``WEBAUTHN_ORIGINS`` is
    # the list of origin strings accepted during verification (cross-origin
    # deploys need both frontend + backend).
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "AMG Portal"
    WEBAUTHN_ORIGINS: list[str] = ["http://localhost:3000"]
    WEBAUTHN_CHALLENGE_TTL_SECONDS: int = 300

    # Trusted reverse proxies (CIDR or exact IPs).
    # X-Forwarded-For is only trusted when the direct connection comes from one of these.
    # Example: ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
    TRUSTED_PROXIES: list[str] = []

    # Rate Limiting (requests per minute per IP — legacy flat limits kept for
    # backward compatibility with any call-sites still using the old single-int
    # ``RateLimiter(action, n)`` signature)
    RATE_LIMIT_LOGIN: int = 5
    RATE_LIMIT_REGISTER: int = 3
    RATE_LIMIT_FORGOT_PASSWORD: int = 3
    RATE_LIMIT_REFRESH: int = 10

    # Per-role tier limits (requests per minute).  ``anon`` keys off client IP;
    # ``authed`` and ``admin`` key off the authenticated user_id so limits are
    # stable across IP changes.  ``admin`` applies to the ``managing_director``
    # role only; every other authenticated role uses ``authed``.
    RATE_LIMIT_TIERS: dict[str, dict[str, int]] = {
        "login": {"anon": 5, "authed": 20, "admin": 100},
        "register": {"anon": 3, "authed": 10, "admin": 30},
        "forgot_password": {"anon": 3, "authed": 10, "admin": 30},
        "refresh": {"anon": 10, "authed": 60, "admin": 200},
        "mfa_disable": {"anon": 5, "authed": 20, "admin": 100},
        "export_pdf": {"anon": 0, "authed": 5, "admin": 20},
        "bulk_email": {"anon": 0, "authed": 3, "admin": 30},
    }

    # Scheduler
    SCHEDULER_ENABLED: bool = True
    SLA_CHECK_INTERVAL_MINUTES: int = 5
    MILESTONE_RISK_CHECK_INTERVAL_MINUTES: int = 15
    DIGEST_HOUR_UTC: int = 8

    # Data retention / archival
    DATA_RETENTION_DAYS: int = 365  # Days after program close before archival eligibility
    ARCHIVE_BATCH_SIZE: int = 100
    AUTO_ARCHIVE_PROGRAMS: bool = False  # Auto-archive when eligible; False = notify only

    # SMTP / Email
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "noreply@amg-portal.com"
    SMTP_TLS: bool = True

    # Travel API Integration
    TRAVEL_WEBHOOK_SECRET: str = ""  # Secret for authenticating travel webhooks

    # Google Calendar Integration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_CALENDAR_REDIRECT_URI: str = (
        ""  # e.g., http://localhost:3000/settings/calendar/callback/google
    )

    # Microsoft / Outlook Calendar Integration
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_CALENDAR_REDIRECT_URI: str = (
        ""  # e.g., http://localhost:3000/settings/calendar/callback/outlook
    )
    MICROSOFT_TENANT_ID: str = "common"  # Use "common" for multi-tenant, or specific tenant ID

    # Security & Intelligence Feed Integration (Phase 2)
    # Leave blank to run in stub/offline mode — no real feed will be contacted.
    SECURITY_FEED_PROVIDER: str | None = None  # e.g. "maxmind", "flashpoint", "custom"
    SECURITY_FEED_API_KEY: str | None = None

    # DocuSign eSignature
    DOCUSIGN_INTEGRATION_KEY: str = ""
    DOCUSIGN_USER_ID: str = ""
    DOCUSIGN_ACCOUNT_ID: str = ""
    DOCUSIGN_PRIVATE_KEY: str = ""
    DOCUSIGN_BASE_URI: str = "https://demo.docusign.net/restapi"
    DOCUSIGN_AUTH_SERVER: str = "account-d.docusign.com"

    # Audit chain (Phase 1.12–1.16).  Ed25519 keys are base64-encoded raw
    # 32-byte values (seed / public-key).  DEBUG deterministically derives a
    # keypair from SECRET_KEY so dev never needs real key material; prod must
    # set both explicitly.  FreeTSA anchors each day's Merkle root (1.13).
    AUDIT_ED25519_PRIVATE_V1: str = ""
    AUDIT_ED25519_PUBLIC_V1: str = ""
    FREETSA_URL: str = "https://freetsa.org/tsr"
    # First UTC date the real chain is active.  Rows before this were
    # backfilled with placeholder row_hash/hmac — verify_day ignores them.
    # Unset defaults to "tomorrow UTC" in __init__ so the migration's
    # placeholder rows never get verified as real chain rows (would otherwise
    # page compliance on the first nightly verify after deploy).  Operators
    # should set this explicitly to the deploy date once backfill is done.
    AUDIT_CHAIN_START_AT: date | None = None
    # Long-lived seed for deriving per-day HMAC keys when
    # AUDIT_HMAC_KEY_YYYYMMDD is not pre-provisioned.  Distinct from
    # SECRET_KEY so a JWT-signing-key compromise does not also compromise
    # the audit HMAC.  Required in production; DEBUG derives from SECRET_KEY.
    AUDIT_HMAC_SEED_V1: str = ""

    # Column encryption KEKs (Phase 1.1).  Each value is a 32-byte key encoded
    # as urlsafe-b64 or hex.  Lazy rotation: bump CURRENT_KEK_ID; old ciphertexts
    # still decrypt via their embedded key-id header byte.  DEBUG derives a
    # deterministic dev key from SECRET_KEY via HKDF.  BIDX key is separate so
    # a compromise of the equality-lookup index does not compromise plaintexts.
    AMG_KEK_KEYS: dict[int, str] = {}
    CURRENT_KEK_ID: int = 1
    AMG_BIDX_KEY_V1: str = ""

    def __init__(self, **kwargs: Any) -> None:  # noqa: PLR0912,PLR0915 — linear config validation chain
        super().__init__(**kwargs)
        # --- SECRET_KEY ---
        _secret_key_placeholder = "change-me-in-production"
        if not self.DEBUG and (not self.SECRET_KEY or _secret_key_placeholder == self.SECRET_KEY):
            raise ValueError(
                "SECRET_KEY must be set in production. "
                "Set a secure random string via the SECRET_KEY environment variable."
            )
        # In DEBUG mode, generate a random key if none is provided so we never
        # ship a hardcoded secret — even for local dev.
        if not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_hex(64)
        # --- MINIO credentials ---
        if not self.DEBUG and not self.MINIO_SECRET_KEY:
            raise ValueError(
                "MINIO_SECRET_KEY must be set in production. "
                "Set a secure value via the MINIO_SECRET_KEY environment variable."
            )
        if not self.DEBUG and not self.MINIO_ACCESS_KEY:
            raise ValueError(
                "MINIO_ACCESS_KEY must be set in production. "
                "Set a value via the MINIO_ACCESS_KEY environment variable."
            )
        # Validate JWT algorithm
        if self.ALGORITHM not in ("HS256", "HS384", "HS512"):
            raise ValueError(
                f"Unsupported JWT algorithm: {self.ALGORITHM}. Use HS256, HS384, or HS512."
            )
        # MFA_EXEMPT_EMAILS is a demo-only bypass that MUST never be populated
        # in a production deployment.  Fail closed: refuse to boot rather than
        # silently emptying the list, so a misconfigured deploy is visible.
        if not self.DEBUG and self.MFA_EXEMPT_EMAILS:
            raise ValueError(
                "MFA_EXEMPT_EMAILS must be empty in production. "
                "This list is a demo-only bypass of the MFA requirement and "
                "must not be set when DEBUG=False."
            )
        # Derive MFA encryption key from SECRET_KEY when not explicitly set
        if not self.MFA_ENCRYPTION_KEY:
            if not self.DEBUG:
                raise ValueError(
                    "MFA_ENCRYPTION_KEY must be set in production. Generate one with: "
                    "python -c 'from cryptography.fernet import Fernet; "
                    "print(Fernet.generate_key().decode())'"
                )
            # Derive a deterministic Fernet key from SECRET_KEY for development
            digest = hashlib.sha256(self.SECRET_KEY.encode("utf-8")).digest()
            self.MFA_ENCRYPTION_KEY = base64.urlsafe_b64encode(digest).decode("utf-8")

        # --- Audit chain Ed25519 keys (Phase 1.13) ---
        if not self.AUDIT_ED25519_PRIVATE_V1 or not self.AUDIT_ED25519_PUBLIC_V1:
            if not self.DEBUG:
                raise ValueError(
                    "AUDIT_ED25519_PRIVATE_V1 and AUDIT_ED25519_PUBLIC_V1 must be set in "
                    "production. Generate with: "
                    "python -c 'import base64; "
                    "from cryptography.hazmat.primitives.asymmetric.ed25519 import "
                    "Ed25519PrivateKey; "
                    "from cryptography.hazmat.primitives.serialization import "
                    "Encoding, PrivateFormat, PublicFormat, NoEncryption; "
                    "sk=Ed25519PrivateKey.generate(); "
                    'print(\"private:\", base64.b64encode(sk.private_bytes('
                    "Encoding.Raw, PrivateFormat.Raw, NoEncryption())).decode()); "
                    'print(\"public:\", base64.b64encode(sk.public_key().public_bytes('
                    "Encoding.Raw, PublicFormat.Raw)).decode())'"
                )
            # DEBUG: derive a deterministic keypair from SECRET_KEY so restarts
            # don't invalidate signatures already in the dev DB.
            from cryptography.hazmat.primitives import hashes as _h
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
            from cryptography.hazmat.primitives.kdf.hkdf import HKDF as _HKDF
            from cryptography.hazmat.primitives.serialization import (
                Encoding,
                NoEncryption,
                PrivateFormat,
                PublicFormat,
            )

            seed = _HKDF(
                algorithm=_h.SHA256(),
                length=32,
                salt=None,
                info=b"amg|audit|ed25519|dev|v1",
            ).derive(self.SECRET_KEY.encode("utf-8"))
            sk = Ed25519PrivateKey.from_private_bytes(seed)
            priv_b64 = base64.b64encode(
                sk.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
            ).decode("utf-8")
            pub_b64 = base64.b64encode(
                sk.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
            ).decode("utf-8")
            self.AUDIT_ED25519_PRIVATE_V1 = priv_b64
            self.AUDIT_ED25519_PUBLIC_V1 = pub_b64
            # Stash into the environment so child helpers that re-read from env
            # (e.g. the Next.js .well-known handler in a dev pod) see the same
            # value.  setdefault preserves any explicit operator override.
            os.environ.setdefault("AUDIT_ED25519_PRIVATE_V1", priv_b64)
            os.environ.setdefault("AUDIT_ED25519_PUBLIC_V1", pub_b64)

        # --- Column-encryption KEK + BIDX keys (Phase 1.1) ---
        if not self.AMG_KEK_KEYS:
            if not self.DEBUG:
                raise ValueError(
                    "AMG_KEK_KEYS must be set in production (JSON dict of "
                    "id->32-byte key, e.g. '{\"1\": \"<urlsafe-b64>\"}')."
                )
            from cryptography.hazmat.primitives import hashes as _h
            from cryptography.hazmat.primitives.kdf.hkdf import HKDF as _HKDF

            dev_kek = _HKDF(
                algorithm=_h.SHA256(),
                length=32,
                salt=None,
                info=b"amg|kek|dev|v1",
            ).derive(self.SECRET_KEY.encode("utf-8"))
            self.AMG_KEK_KEYS = {1: base64.urlsafe_b64encode(dev_kek).decode("utf-8")}
            self.CURRENT_KEK_ID = 1
        if not self.AMG_BIDX_KEY_V1:
            if not self.DEBUG:
                raise ValueError(
                    "AMG_BIDX_KEY_V1 must be set in production. 32 bytes urlsafe-b64."
                )
            from cryptography.hazmat.primitives import hashes as _h2
            from cryptography.hazmat.primitives.kdf.hkdf import HKDF as _HKDF2

            dev_bidx = _HKDF2(
                algorithm=_h2.SHA256(),
                length=32,
                salt=None,
                info=b"amg|bidx|dev|v1",
            ).derive(self.SECRET_KEY.encode("utf-8"))
            self.AMG_BIDX_KEY_V1 = base64.urlsafe_b64encode(dev_bidx).decode("utf-8")

        # --- Audit-chain HMAC seed (Phase 1.12 Fix C) ---
        # Distinct from SECRET_KEY so a JWT-signing-key compromise does not
        # also let an attacker forge valid audit HMACs.  Required in prod;
        # derived from SECRET_KEY (with a dedicated info label) in DEBUG.
        if not self.AUDIT_HMAC_SEED_V1:
            if not self.DEBUG:
                raise ValueError(
                    "AUDIT_HMAC_SEED_V1 must be set in production (32 bytes "
                    "urlsafe-b64).  Generate with: "
                    "python -c 'import secrets,base64; "
                    "print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())'"
                )
            from cryptography.hazmat.primitives import hashes as _h3
            from cryptography.hazmat.primitives.kdf.hkdf import HKDF as _HKDF3

            dev_seed = _HKDF3(
                algorithm=_h3.SHA256(),
                length=32,
                salt=None,
                info=b"amg|audit|hmac|seed|dev|v1",
            ).derive(self.SECRET_KEY.encode("utf-8"))
            self.AUDIT_HMAC_SEED_V1 = base64.urlsafe_b64encode(dev_seed).decode("utf-8")

        # --- Audit-chain start-at default (Phase 1.12 Fix B) ---
        # When unset, default to tomorrow UTC so verify_day skips rows
        # created up to and including the deploy day (their row_hash may be
        # a placeholder from the backfill migration).  Operators should set
        # AUDIT_CHAIN_START_AT explicitly to pin the chain genesis.
        if self.AUDIT_CHAIN_START_AT is None:
            import logging
            from datetime import UTC, datetime, timedelta

            tomorrow = (datetime.now(UTC) + timedelta(days=1)).date()
            self.AUDIT_CHAIN_START_AT = tomorrow
            logging.getLogger(__name__).warning(
                "AUDIT_CHAIN_START_AT not set; defaulting to %s (tomorrow UTC). "
                "Set this explicitly in production once backfill is complete.",
                tomorrow.isoformat(),
            )


settings = Settings()
