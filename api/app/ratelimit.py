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
    """One default rule plus optional per-path-prefix overrides, each with its own window.

    `overrides` maps a path prefix (e.g. "/portfolio/simulate") to a rule; the longest matching
    prefix wins and its hits are counted separately from the default budget.
    """

    def __init__(
        self, rule: str, *, overrides: dict[str, str] | None = None, enabled: bool = True
    ) -> None:
        self.item: RateLimitItem = parse(rule)
        self.enabled = enabled
        self._strategy = MovingWindowRateLimiter(MemoryStorage())
        prefixed = sorted((overrides or {}).items(), key=lambda kv: -len(kv[0]))
        self._rules: list[tuple[str, RateLimitItem]] = [
            (prefix, parse(spec)) for prefix, spec in prefixed
        ] + [("", self.item)]

    def match(self, path: str) -> tuple[str, RateLimitItem]:
        """(scope, rule) for a request path; scope "" is the default bucket."""
        for prefix, item in self._rules:
            if path.startswith(prefix):
                return prefix, item
        return "", self.item  # pragma: no cover - the "" rule always matches

    def hit(self, key: str, path: str = "") -> tuple[bool, int, int, RateLimitItem]:
        """Record a hit. Returns (allowed, remaining, seconds_until_reset, rule)."""
        scope, item = self.match(path)
        storage_key = f"{scope}:{key}"
        allowed = self._strategy.hit(item, storage_key)
        stats = self._strategy.get_window_stats(item, storage_key)
        reset_in = max(0, math.ceil(stats.reset_time - time.time()))
        return allowed, stats.remaining, reset_in, item

    async def middleware(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not self.enabled or request.url.path in EXEMPT_PATHS:
            return await call_next(request)
        allowed, remaining, reset_in, item = self.hit(client_ip(request), request.url.path)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded: {item}"},
                headers={"Retry-After": str(max(1, reset_in))},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(item.amount)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_in)
        return response
