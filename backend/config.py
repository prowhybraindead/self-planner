from functools import lru_cache
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "SelfPlanner Backend"
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    APP_TIMEZONE: str = "Asia/Ho_Chi_Minh"

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    FIREBASE_CREDENTIALS_PATH: str | None = None
    FCM_PROJECT_ID: str | None = None
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,https://localhost,capacitor://localhost"
    CORS_ALLOW_ORIGIN_REGEX: str = r"^https:\/\/([a-zA-Z0-9-]+\.)?vercel\.app$"

    @field_validator("APP_PORT")
    @classmethod
    def validate_port(cls, value: int) -> int:
        if value < 1 or value > 65535:
            raise ValueError("APP_PORT must be between 1 and 65535")
        return value

    @field_validator("SMTP_PORT")
    @classmethod
    def validate_smtp_port(cls, value: int) -> int:
        if value < 1 or value > 65535:
            raise ValueError("SMTP_PORT must be between 1 and 65535")
        return value

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
