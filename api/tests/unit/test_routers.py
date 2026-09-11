from fastapi.testclient import TestClient

from tests.fakes import FakeYF


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_search(client: TestClient) -> None:
    r = client.get("/search", params={"q": "apple", "limit": 2})
    assert r.status_code == 200
    assert [x["symbol"] for x in r.json()] == ["AAPL", "APC.DE"]


def test_search_validation(client: TestClient) -> None:
    assert client.get("/search").status_code == 422
    assert client.get("/search", params={"q": "a", "limit": 0}).status_code == 422


def test_quote(client: TestClient) -> None:
    r = client.get("/quote/aapl")
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["price"] == 200.0


def test_quote_unknown_is_404(client: TestClient) -> None:
    r = client.get("/quote/NOPE")
    assert r.status_code == 404
    assert r.json() == {"detail": "Unknown ticker: NOPE"}


def test_quotes_batch(client: TestClient) -> None:
    r = client.get("/quotes", params={"tickers": "aapl, msft,nope"})
    assert r.status_code == 200
    body = r.json()
    assert [q["symbol"] for q in body["quotes"]] == ["AAPL", "MSFT"]
    assert body["missing"] == ["NOPE"]
    assert client.get("/quotes").status_code == 422


def test_history(client: TestClient) -> None:
    r = client.get("/history/AAPL", params={"period": "1mo", "interval": "1d"})
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["period"] == "1mo"
    assert len(body["candles"]) == 30
    candle = body["candles"][0]
    assert set(candle) == {"time", "open", "high", "low", "close", "volume"}
    assert candle["low"] <= candle["close"] <= candle["high"]


def test_history_rejects_bad_period(client: TestClient) -> None:
    assert client.get("/history/AAPL", params={"period": "3d"}).status_code == 422
    assert client.get("/history/AAPL", params={"interval": "2h"}).status_code == 422


def test_indicators(client: TestClient) -> None:
    r = client.get("/indicators/AAPL")
    assert r.status_code == 200
    body = r.json()
    n = len(body["candles"])
    assert n == 30
    assert set(body["ema"]) == {"10", "30", "60", "90"}
    assert all(len(series) == n for series in body["ema"].values())
    assert body["ema"]["10"][0] == body["candles"][0]["close"]
    bands = body["bollinger"]
    assert bands["window"] == 20
    assert bands["middle"][:19] == [None] * 19
    assert bands["upper"][-1] > bands["middle"][-1] > bands["lower"][-1]
    assert isinstance(body["levels"], list)
    for lv in body["levels"]:
        assert lv["kind"] in {"support", "resistance"}
        assert lv["touches"] >= 1


def test_indicators_unknown_ticker(client: TestClient) -> None:
    assert client.get("/indicators/NOPE").status_code == 404


def test_recommendations(client: TestClient) -> None:
    r = client.get("/recommendations/AAPL")
    assert r.status_code == 200
    body = r.json()
    assert body["summary"][0]["strong_buy"] == 6
    assert body["price_targets"]["median"] == 230.0
    assert body["upgrades_downgrades"][0]["firm"] == "Morgan Stanley"


def test_rate_limit_is_503_with_retry_after(client: TestClient, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_rate_limit()
    r = client.get("/quote/AAPL")
    assert r.status_code == 503
    assert r.headers["retry-after"] == "30"


def test_upstream_failure_is_502(client: TestClient, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_upstream()
    r = client.get("/history/AAPL")
    assert r.status_code == 502
    assert "Yahoo Finance" in r.json()["detail"]


def test_crypto_top(client: TestClient) -> None:
    r = client.get("/crypto/top", params={"limit": 2})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["as_of"], int)
    assert [c["symbol"] for c in body["coins"]] == ["BTC-USD", "ETH-USD"]
    assert set(body["coins"][0]) == {
        "symbol",
        "name",
        "price",
        "change_pct",
        "market_cap",
        "volume",
        "circulating_supply",
    }
    assert client.get("/crypto/top").status_code == 200  # default limit


def test_crypto_top_validation(client: TestClient) -> None:
    assert client.get("/crypto/top", params={"limit": 0}).status_code == 422
    assert client.get("/crypto/top", params={"limit": 500}).status_code == 422


def test_crypto_top_upstream_failure_is_502(client: TestClient, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_upstream()
    assert client.get("/crypto/top").status_code == 502


def test_cors_allows_dev_origin(client: TestClient) -> None:
    r = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
