from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables or a `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="STOCK_API_", extra="ignore")

    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Cache TTLs in seconds.
    search_ttl: int = 60 * 60 * 24
    quote_ttl: int = 60
    history_ttl: int = 60 * 5
    recommendations_ttl: int = 60 * 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
