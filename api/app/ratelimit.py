"""Per-client rate limiting as plain HTTP middleware (moving window, in-process storage).

Built on the `limits` library directly rather than slowapi: FastAPI registers routers lazily
and slowapi's middleware cannot resolve the route, so its default limits never fire.
"""

from __future__ import annotations

import math
import time
from collections.abc import Awaitable, Callable

from limits import RateLimitItem, parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.logging_config import client_ip

EXEMPT_PATHS = frozenset({"/health", "/docs", "/redoc", "/openapi.json"})


class RateLimiter:
    def __init__(self, rule: str, *, enabled: bool = True) -> None:
        self.item: RateLimitItem = parse(rule)
        self.enabled = enabled
        self._strategy = MovingWindowRateLimiter(MemoryStorage())

    def hit(self, key: str) -> tuple[bool, int, int]:
        """Record a hit. Returns (allowed, remaining, seconds_until_reset)."""
        allowed = self._strategy.hit(self.item, key)
        stats = self._strategy.get_window_stats(self.item, key)
        reset_in = max(0, math.ceil(stats.reset_time - time.time()))
        return allowed, stats.remaining, reset_in

    async def middleware(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not self.enabled or request.url.path in EXEMPT_PATHS:
            return await call_next(request)
        allowed, remaining, reset_in = self.hit(client_ip(request))
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded: {self.item}"},
                headers={"Retry-After": str(max(1, reset_in))},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.item.amount)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_in)
        return response
