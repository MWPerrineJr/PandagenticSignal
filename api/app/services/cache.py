"""Thread-safe, namespaced TTL cache built on `cachetools.TTLCache`.

Each namespace (search, quote, history, ...) gets its own `TTLCache` with its own TTL, so
per-endpoint expiry can be tuned from `Settings` without touching call sites.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from typing import Any

from cachetools import TTLCache

Timer = Callable[[], float]


class Cache:
    def __init__(self, *, maxsize: int = 1024, timer: Timer = time.monotonic) -> None:
        self._maxsize = maxsize
        self._timer = timer
        self._caches: dict[str, TTLCache] = {}
        self._lock = threading.RLock()

    def _bucket(self, namespace: str, ttl: float) -> TTLCache:
        bucket = self._caches.get(namespace)
        if bucket is None or bucket.ttl != ttl:
            bucket = TTLCache(maxsize=self._maxsize, ttl=ttl, timer=self._timer)
            self._caches[namespace] = bucket
        return bucket

    def get_or_set(self, namespace: str, key: Any, ttl: float, factory: Callable[[], Any]) -> Any:
        """Return the cached value for `key`, computing and storing it via `factory` on a miss.

        The factory runs under the cache lock so concurrent misses for the same key only hit
        the upstream once. Exceptions from the factory propagate and nothing is cached.
        """
        with self._lock:
            bucket = self._bucket(namespace, ttl)
            try:
                return bucket[key]
            except KeyError:
                pass
            value = factory()
            bucket[key] = value
            return value

    def invalidate(self, namespace: str | None = None) -> None:
        with self._lock:
            if namespace is None:
                self._caches.clear()
            else:
                self._caches.pop(namespace, None)

    def size(self, namespace: str) -> int:
        with self._lock:
            bucket = self._caches.get(namespace)
            return len(bucket) if bucket is not None else 0
