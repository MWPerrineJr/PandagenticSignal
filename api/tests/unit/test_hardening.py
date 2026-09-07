import json
import logging

from fastapi.testclient import TestClient

from app.logging_config import JsonFormatter, client_ip
from app.main import create_app
from app.settings import Settings


def test_rate_limit_returns_429_with_retry_after() -> None:
    client = TestClient(create_app(Settings(rate_limit="2/minute")))
    assert client.get("/quote/AAPL").status_code != 429  # 404 or 502 offline; limiter counts it
    assert client.get("/quote/AAPL").status_code != 429
    third = client.get("/quote/AAPL")
    assert third.status_code == 429
    assert third.headers["retry-after"] == "60"
    assert "Rate limit exceeded" in third.json()["detail"]


def test_health_is_exempt_from_rate_limit() -> None:
    client = TestClient(create_app(Settings(rate_limit="1/minute")))
    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_rate_limit_is_keyed_by_forwarded_ip() -> None:
    client = TestClient(create_app(Settings(rate_limit="1/minute")))
    assert client.get("/search?q=x", headers={"x-forwarded-for": "1.1.1.1, 10.0.0.1"}).status_code != 429
    assert client.get("/search?q=x", headers={"x-forwarded-for": "1.1.1.1, 10.0.0.1"}).status_code == 429
    assert client.get("/search?q=x", headers={"x-forwarded-for": "2.2.2.2"}).status_code != 429


def test_rate_limit_can_be_disabled() -> None:
    client = TestClient(create_app(Settings(rate_limit="1/minute", rate_limit_enabled=False)))
    for _ in range(3):
        assert client.get("/search?q=x").status_code != 429


def test_cors_rejects_unknown_origin() -> None:
    client = TestClient(create_app(Settings(cors_origins="https://app.example.com")))
    ok = client.get("/health", headers={"Origin": "https://app.example.com"})
    assert ok.headers.get("access-control-allow-origin") == "https://app.example.com"
    bad = client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in bad.headers


def test_json_formatter_emits_one_object_per_line() -> None:
    record = logging.LogRecord("app.access", logging.INFO, __file__, 1, "GET /health 200", None, None)
    record.extra = {"status": 200, "duration_ms": 1.5}  # type: ignore[attr-defined]
    line = JsonFormatter().format(record)
    parsed = json.loads(line)
    assert parsed["msg"] == "GET /health 200"
    assert parsed["status"] == 200
    assert parsed["level"] == "INFO"


def test_json_access_log(capsys) -> None:
    client = TestClient(create_app(Settings(log_format="json")))
    client.get("/health", headers={"x-forwarded-for": "9.9.9.9"})
    out = capsys.readouterr().err.strip().splitlines()
    entry = json.loads(out[-1])
    assert entry["path"] == "/health"
    assert entry["status"] == 200
    assert entry["client"] == "9.9.9.9"


def test_client_ip_falls_back_to_socket() -> None:
    class Req:
        headers: dict[str, str] = {}

        class client:
            host = "127.0.0.1"

    assert client_ip(Req()) == "127.0.0.1"  # type: ignore[arg-type]
