from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://flyingtheunit:changeme@localhost:5435/flyingtheunit"
    database_url_sync: str = "postgresql://flyingtheunit:changeme@localhost:5435/flyingtheunit"

    # Redis
    redis_url: str = "redis://localhost:6380/0"

    # App
    secret_key: str = "dev-secret-key"
    environment: str = "development"

    # Reddit
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "flyingtheunit:v1.0.0"

    # YouTube
    youtube_api_key: str = ""

    # Bluesky
    bluesky_handle: str = ""
    bluesky_app_password: str = ""

    # Gemini (Tier 2)
    gemini_api_key: str = ""

    # Alerts
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_from_email: str = ""
    alert_to_email: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
