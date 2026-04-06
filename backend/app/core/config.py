import base64
import hashlib

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "AMG Portal"
    DEBUG: bool = False
    SQL_ECHO: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://amg:amg_dev_password@localhost:5433/amg_portal"

    # Redis
    REDIS_URL: str = "redis://localhost:6380/0"

    # JWT
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # MinIO / S3
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "amg_minio"
    MINIO_SECRET_KEY: str = "amg_minio_secret"
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

    # MFA
    MFA_GRACE_PERIOD_DAYS: int = 7
    MFA_SETUP_TOKEN_EXPIRE_MINUTES: int = 30
    MFA_ENCRYPTION_KEY: str = ""  # Fernet key for encrypting MFA secrets at rest
    # Emails that are permanently exempt from MFA (e.g. demo accounts). JSON array string.
    MFA_EXEMPT_EMAILS: list[str] = []

    # Password Reset
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # Trusted reverse proxies (CIDR or exact IPs).
    # X-Forwarded-For is only trusted when the direct connection comes from one of these.
    # Example: ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
    TRUSTED_PROXIES: list[str] = []

    # Rate Limiting (requests per minute per IP)
    RATE_LIMIT_LOGIN: int = 5
    RATE_LIMIT_REGISTER: int = 3
    RATE_LIMIT_FORGOT_PASSWORD: int = 3
    RATE_LIMIT_REFRESH: int = 10

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

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Require SECRET_KEY to be set in non-debug environments
        _secret_key_placeholder = "change-me-in-production"
        if not self.DEBUG and (not self.SECRET_KEY or _secret_key_placeholder == self.SECRET_KEY):
            raise ValueError(
                "SECRET_KEY must be set in production. "
                "Set a secure random string via the SECRET_KEY environment variable."
            )
        # Use a development key only in DEBUG mode
        if not self.SECRET_KEY:
            self.SECRET_KEY = "dev-secret-key-change-in-production-do-not-use-in-prod"
        # Require MINIO_SECRET_KEY to be overridden in non-debug environments
        if not self.DEBUG and self.MINIO_SECRET_KEY == "amg_minio_secret":
            raise ValueError(
                "MINIO_SECRET_KEY must be changed from the default in production. "
                "Set a secure value via the MINIO_SECRET_KEY environment variable."
            )
        # Validate JWT algorithm
        if self.ALGORITHM not in ("HS256", "HS384", "HS512"):
            raise ValueError(
                f"Unsupported JWT algorithm: {self.ALGORITHM}. Use HS256, HS384, or HS512."
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


settings = Settings()
