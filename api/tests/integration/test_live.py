"""Live checks against Yahoo Finance. Excluded by default; run with `pytest -m integration`."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def live() -> TestClient:
    return TestClient(create_app())


def test_search_live(live: TestClient) -> None:
    r = live.get("/search", params={"q": "apple"})
    assert r.status_code == 200
    assert any(x["symbol"] == "AAPL" for x in r.json())


def test_quote_live(live: TestClient) -> None:
    r = live.get("/quote/AAPL")
    assert r.status_code == 200
    assert r.json()["price"] > 0


def test_quotes_live(live: TestClient) -> None:
    r = live.get("/quotes", params={"tickers": "AAPL,MSFT,ZZZZNOTREAL"})
    assert r.status_code == 200
    assert {q["symbol"] for q in r.json()["quotes"]} == {"AAPL", "MSFT"}
    assert r.json()["missing"] == ["ZZZZNOTREAL"]


def test_history_live(live: TestClient) -> None:
    r = live.get("/history/AAPL", params={"period": "1mo", "interval": "1d"})
    assert r.status_code == 200
    assert len(r.json()["candles"]) >= 15


def test_indicators_live(live: TestClient) -> None:
    r = live.get("/indicators/AAPL", params={"period": "6mo"})
    assert r.status_code == 200
    body = r.json()
    assert body["ema"]["90"][-1] is not None
    assert body["levels"]


def test_recommendations_live(live: TestClient) -> None:
    r = live.get("/recommendations/AAPL")
    assert r.status_code == 200
    assert r.json()["summary"]


def test_unknown_ticker_live(live: TestClient) -> None:
    assert live.get("/quote/ZZZZNOTREAL").status_code == 404
    assert live.get("/history/ZZZZNOTREAL").status_code == 404
