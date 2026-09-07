import pytest

from app.services.cache import Cache


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_miss_then_hit_calls_factory_once() -> None:
    clock = Clock()
    cache = Cache(timer=clock)
    calls = []

    def factory():
        calls.append(1)
        return "value"

    assert cache.get_or_set("ns", "k", 10, factory) == "value"
    assert cache.get_or_set("ns", "k", 10, factory) == "value"
    assert len(calls) == 1
    assert cache.size("ns") == 1


def test_entry_expires_after_ttl() -> None:
    clock = Clock()
    cache = Cache(timer=clock)
    values = iter(["first", "second"])
    factory = lambda: next(values)  # noqa: E731

    assert cache.get_or_set("ns", "k", 10, factory) == "first"
    clock.now = 9.9
    assert cache.get_or_set("ns", "k", 10, factory) == "first"
    clock.now = 10.1
    assert cache.get_or_set("ns", "k", 10, factory) == "second"


def test_namespaces_are_independent() -> None:
    cache = Cache(timer=Clock())
    assert cache.get_or_set("a", "k", 10, lambda: 1) == 1
    assert cache.get_or_set("b", "k", 10, lambda: 2) == 2
    assert cache.size("a") == 1
    assert cache.size("b") == 1
    assert cache.size("missing") == 0


def test_factory_exception_is_not_cached() -> None:
    cache = Cache(timer=Clock())
    attempts = []

    def flaky():
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("upstream down")
        return "ok"

    with pytest.raises(RuntimeError):
        cache.get_or_set("ns", "k", 10, flaky)
    assert cache.get_or_set("ns", "k", 10, flaky) == "ok"
    assert len(attempts) == 2


def test_invalidate_clears_one_or_all_namespaces() -> None:
    cache = Cache(timer=Clock())
    cache.get_or_set("a", "k", 10, lambda: 1)
    cache.get_or_set("b", "k", 10, lambda: 2)
    cache.invalidate("a")
    assert cache.size("a") == 0
    assert cache.size("b") == 1
    cache.invalidate()
    assert cache.size("b") == 0


def test_changing_ttl_rebuilds_bucket() -> None:
    cache = Cache(timer=Clock())
    cache.get_or_set("a", "k", 10, lambda: 1)
    assert cache.get_or_set("a", "k", 20, lambda: 2) == 2
