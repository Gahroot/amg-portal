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
    SECRET_KEY: str = "change-me-in-production"
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


settings = Settings()
