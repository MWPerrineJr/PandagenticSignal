"""Domain exceptions raised by the services layer and mapped to HTTP responses in `main.py`."""


class MarketDataError(Exception):
    """Base class for market-data failures."""


class TickerNotFoundError(MarketDataError):
    """Yahoo Finance has no data for the requested symbol (HTTP 404)."""

    def __init__(self, ticker: str) -> None:
        self.ticker = ticker
        super().__init__(f"Unknown ticker: {ticker}")


class UpstreamError(MarketDataError):
    """Yahoo Finance failed or returned something unusable (HTTP 502)."""


class RateLimitedError(MarketDataError):
    """Yahoo Finance is rate-limiting us (HTTP 503)."""
