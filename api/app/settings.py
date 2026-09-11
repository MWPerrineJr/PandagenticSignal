from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables or a `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="STOCK_API_", extra="ignore")

    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex matched against the full origin, for hosts with per-deploy subdomains
    # (e.g. Lovable's preview + published sites): r"https://.*\.lovable\.app". Empty = off.
    cors_origin_regex: str = ""

    # Cache TTLs in seconds.
    search_ttl: int = 60 * 60 * 24
    quote_ttl: int = 60
    history_ttl: int = 60 * 5
    recommendations_ttl: int = 60 * 60
    # Crypto: Coinbase prices/candles and the CoinGecko ranking are both public and keyless.
    crypto_ttl: int = 60
    coinbase_api_url: str = "https://api.coinbase.com/api/v3/brokerage/market"
    coingecko_api_url: str = "https://api.coingecko.com/api/v3"
    # Optional CoinGecko demo key (raises the public rate limit); sent as x-cg-demo-api-key.
    coingecko_api_key: str = ""
    http_timeout: float = 10.0

    # Per-client rate limit (slowapi syntax), keyed by forwarded client IP.
    rate_limit: str = "120/minute"
    rate_limit_enabled: bool = True
    # Tighter budget for the CPU-heavy simulation endpoints (same syntax, own window).
    simulate_rate_limit: str = "30/minute"

    # "text" for local development, "json" for hosted logs.
    log_format: Literal["text", "json"] = "text"
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
