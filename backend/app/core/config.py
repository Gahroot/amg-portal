from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "AMG Portal"
    DEBUG: bool = True
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

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Scheduler
    SCHEDULER_ENABLED: bool = True
    SLA_CHECK_INTERVAL_MINUTES: int = 5
    MILESTONE_RISK_CHECK_INTERVAL_MINUTES: int = 15
    ESCALATION_PROMOTION_CHECK_INTERVAL_MINUTES: int = 15
    DIGEST_HOUR_UTC: int = 8

    # Capacity planning
    MAX_PROGRAMS_PER_RM: int = 10
    PREDICTIVE_ALERT_CHECK_HOUR_UTC: int = 7

    # Partner governance
    PARTNER_MIN_PERFORMANCE_SCORE: float = 3.0  # Out of 5.0
    PARTNER_PROBATION_ENGAGEMENT_COUNT: int = 3
    PARTNER_GOVERNANCE_CHECK_DAY: int = 1  # Day of month for governance job

    # Capability review & audit reminders
    CAPABILITY_REVIEW_REMINDER_DAYS: int = 30
    AUDIT_REMINDER_DAY_OF_QUARTER: int = 1
    DORMANT_ACCOUNT_DAYS: int = 90

    # Data retention & archival
    DATA_RETENTION_DAYS: int = 365  # Days after program closure before archival
    AUTO_ARCHIVE_ENABLED: bool = True

    # SMTP / Email
    # For development, use Mailpit (SMTP_HOST=localhost SMTP_PORT=1025 SMTP_TLS=false)
    # or MailHog (same settings). Both capture emails in a local web UI.
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "noreply@amg-portal.com"
    SMTP_TLS: bool = True
    # SMTP_STARTTLS: use STARTTLS on port 587 (default True).
    # Set to False and SMTP_TLS=True for implicit TLS on port 465.
    SMTP_STARTTLS: bool = True

    # CRM Integration
    CRM_PROVIDER: str = ""  # "hubspot", "salesforce", or empty to disable
    CRM_API_KEY: str = ""
    CRM_BASE_URL: str = ""
    CRM_SYNC_ENABLED: bool = False
    CRM_SYNC_INTERVAL_MINUTES: int = 30

    # DocuSign
    DOCUSIGN_INTEGRATION_KEY: str = ""
    DOCUSIGN_SECRET_KEY: str = ""
    DOCUSIGN_ACCOUNT_ID: str = ""
    DOCUSIGN_USER_ID: str = ""  # Impersonated user GUID for JWT grant
    DOCUSIGN_RSA_PRIVATE_KEY: str = ""  # PEM-encoded RSA private key (newlines as \n)
    DOCUSIGN_BASE_URL: str = "https://demo.docusign.net/restapi"
    DOCUSIGN_OAUTH_BASE_URL: str = "https://account-d.docusign.com"
    DOCUSIGN_WEBHOOK_SECRET: str = ""  # HMAC secret for Connect webhook verification
    DOCUSIGN_ENVELOPE_STATUS_CHECK_MINUTES: int = 10

    # Google Calendar OAuth
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None

    # Microsoft/Outlook Calendar OAuth
    MICROSOFT_CLIENT_ID: str | None = None
    MICROSOFT_CLIENT_SECRET: str | None = None
    MICROSOFT_TENANT_ID: str | None = None  # For multi-tenant apps

    # Calendar Reminder Settings
    CALENDAR_REMINDER_CHECK_INTERVAL_MINUTES: int = 15
    CALENDAR_DEFAULT_REMINDER_MINUTES: int = 60

    def __init__(self, **kwargs) -> Any:
        super().__init__(**kwargs)
        # Require SECRET_KEY to be set in non-debug environments
        if not self.DEBUG and not self.SECRET_KEY:
            raise ValueError(
                "SECRET_KEY must be set in production. "
                "Set a secure random string via the SECRET_KEY environment variable."
            )
        # Use a development key only in DEBUG mode
        if not self.SECRET_KEY:
            self.SECRET_KEY = "dev-secret-key-change-in-production-do-not-use-in-prod"
        # Validate JWT algorithm
        if self.ALGORITHM not in ("HS256", "HS384", "HS512"):
            raise ValueError(
                f"Unsupported JWT algorithm: {self.ALGORITHM}. Use HS256, HS384, or HS512."
            )


settings = Settings()
