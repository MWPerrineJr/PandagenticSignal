import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.deps import get_market_data
from app.logging_config import JsonFormatter, client_ip
from app.main import create_app
from app.services.market_data import MarketData
from app.settings import Settings


@pytest.fixture
def make_client(market_data: MarketData):
    """TestClient factory over the fake market data with custom settings."""

    def _make(**overrides) -> TestClient:
        app = create_app(Settings(**overrides))
        app.dependency_overrides[get_market_data] = lambda: market_data
        return TestClient(app)

    return _make


def test_rate_limit_returns_429_with_retry_after(make_client) -> None:
    client = make_client(rate_limit="2/minute")
    assert client.get("/quote/AAPL").status_code == 200
    assert client.get("/quote/AAPL").status_code == 200
    third = client.get("/quote/AAPL")
    assert third.status_code == 429
    assert 1 <= int(third.headers["retry-after"]) <= 60
    assert "Rate limit exceeded" in third.json()["detail"]


def test_rate_limit_headers_on_allowed_requests(make_client) -> None:
    client = make_client(rate_limit="5/minute")
    r = client.get("/quote/AAPL")
    assert r.headers["x-ratelimit-limit"] == "5"
    assert r.headers["x-ratelimit-remaining"] == "4"
    assert int(r.headers["x-ratelimit-reset"]) <= 60


def test_simulate_has_its_own_rate_limit_window(make_client) -> None:
    client = make_client(rate_limit="10/minute", simulate_rate_limit="1/minute")
    body = {"holdings": [{"symbol": "AAPL", "weight": 1}], "n_sims": 100, "horizon_years": 1}
    first = client.post("/portfolio/simulate", json=body)
    assert first.status_code == 200
    assert first.headers["x-ratelimit-limit"] == "1"
    second = client.post("/portfolio/simulate", json=body)
    assert second.status_code == 429
    assert "1 per 1 minute" in second.json()["detail"]
    # The default budget is untouched by simulate hits, and analyse uses the default rule.
    r = client.get("/quote/AAPL")
    assert r.status_code == 200 and r.headers["x-ratelimit-remaining"] == "9"
    assert client.post("/portfolio/analyse", json=body).status_code == 200
    # /retirement shares the tighter rule but its own window.
    retire = {
        "current_age": 30,
        "retirement_age": 60,
        "life_expectancy": 85,
        "current_savings": 1,
        "monthly_contribution": 1,
        "annual_spending": 1,
        "n_sims": 100,
    }
    assert client.post("/retirement/project", json=retire).status_code == 200
    assert client.post("/retirement/project", json=retire).status_code == 429


def test_cors_preflight_allows_post(make_client) -> None:
    client = make_client(cors_origins="https://app.example.com")
    r = client.options(
        "/portfolio/simulate",
        headers={
            "Origin": "https://app.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert "POST" in r.headers["access-control-allow-methods"]


def test_health_is_exempt_from_rate_limit(make_client) -> None:
    client = make_client(rate_limit="1/minute")
    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_rate_limit_is_keyed_by_forwarded_ip(make_client) -> None:
    client = make_client(rate_limit="1/minute")
    behind_proxy = {"x-forwarded-for": "1.1.1.1, 10.0.0.1"}
    assert client.get("/search?q=apple", headers=behind_proxy).status_code == 200
    assert client.get("/search?q=apple", headers=behind_proxy).status_code == 429
    assert client.get("/search?q=apple", headers={"x-forwarded-for": "2.2.2.2"}).status_code == 200


def test_rate_limit_can_be_disabled(make_client) -> None:
    client = make_client(rate_limit="1/minute", rate_limit_enabled=False)
    for _ in range(3):
        assert client.get("/search?q=apple").status_code == 200


def test_cors_rejects_unknown_origin(make_client) -> None:
    client = make_client(cors_origins="https://app.example.com")
    ok = client.get("/health", headers={"Origin": "https://app.example.com"})
    assert ok.headers.get("access-control-allow-origin") == "https://app.example.com"
    bad = client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in bad.headers


def test_cors_origin_regex_matches_lovable_subdomains(make_client) -> None:
    client = make_client(
        cors_origins="http://localhost:5173", cors_origin_regex=r"https://.*\.lovable\.app"
    )
    for origin in (
        "https://id-preview--553ee360-dd3b-43d1-93f9-254d89ad2fc0.lovable.app",
        "https://stock-ui-builder.lovable.app",
        "http://localhost:5173",
    ):
        r = client.get("/health", headers={"Origin": origin})
        assert r.headers.get("access-control-allow-origin") == origin, origin
    bad = client.get("/health", headers={"Origin": "https://lovable.app.evil.example"})
    assert "access-control-allow-origin" not in bad.headers


def test_json_formatter_emits_one_object_per_line() -> None:
    record = logging.LogRecord(
        "app.access", logging.INFO, __file__, 1, "GET /health 200", None, None
    )
    record.extra = {"status": 200, "duration_ms": 1.5}  # type: ignore[attr-defined]
    line = JsonFormatter().format(record)
    parsed = json.loads(line)
    assert parsed["msg"] == "GET /health 200"
    assert parsed["status"] == 200
    assert parsed["level"] == "INFO"


def test_json_access_log(capsys) -> None:
    client = TestClient(create_app(Settings(log_format="json")))
    client.get("/health", headers={"x-forwarded-for": "9.9.9.9"})
    lines = [json.loads(line) for line in capsys.readouterr().err.strip().splitlines()]
    entry = next(e for e in lines if e["logger"] == "app.access")
    assert entry["path"] == "/health"
    assert entry["status"] == 200
    assert entry["client"] == "9.9.9.9"


def test_client_ip_falls_back_to_socket() -> None:
    class Req:
        headers: dict[str, str] = {}

        class client:
            host = "127.0.0.1"

    assert client_ip(Req()) == "127.0.0.1"  # type: ignore[arg-type]
