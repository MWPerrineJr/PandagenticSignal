import pytest
from fastapi.testclient import TestClient

from app.errors import RateLimitedError, UpstreamError
from tests.fakes import FakeFetch, FakeYF


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
        "rank",
        "icon",
        "high_24h",
        "low_24h",
        "price_source",
    }
    assert body["coins"][0]["price_source"] == "coinbase"
    assert client.get("/crypto/top").status_code == 200  # default limit


def test_crypto_quote_and_history_routes(client: TestClient) -> None:
    q = client.get("/quote/BTC-USD").json()
    assert q["exchange"] == "Coinbase"
    assert q["day_high"] == 66000.0
    h = client.get("/history/BTC-USD", params={"period": "5d", "interval": "1h"}).json()
    assert h["symbol"] == "BTC-USD"
    assert 118 <= len(h["candles"]) <= 122
    assert client.get("/indicators/ETH-USD", params={"period": "6mo"}).status_code == 200


def test_crypto_top_validation(client: TestClient) -> None:
    assert client.get("/crypto/top", params={"limit": 0}).status_code == 422
    assert client.get("/crypto/top", params={"limit": 500}).status_code == 422


def test_crypto_top_upstream_failure_is_502(client: TestClient, fake_fetch: FakeFetch) -> None:
    fake_fetch.error = UpstreamError("CoinGecko returned 502")
    assert client.get("/crypto/top").status_code == 502
    fake_fetch.error = RateLimitedError("CoinGecko rate limit reached")
    assert client.get("/crypto/top", params={"limit": 7}).status_code == 503


def test_portfolio_analyse(client: TestClient) -> None:
    body = {"holdings": [{"symbol": "aapl", "weight": 3}, {"symbol": "BTC-USD", "weight": 1}]}
    r = client.post("/portfolio/analyse", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["symbols"] == ["AAPL", "BTC-USD"]
    assert out["weights"] == [0.75, 0.25]
    assert out["period"] == "2y" and out["n_obs"] >= 20
    assert out["start"] < out["end"]
    assert len(out["correlation"]) == 2 and out["correlation"][0][0] == 1.0
    assert [a["symbol"] for a in out["assets"]] == ["AAPL", "BTC-USD"]
    assert -1 <= out["max_drawdown"] <= 0
    amounts = {"holdings": [{"symbol": "AAPL", "amount": 500}, {"symbol": "MSFT", "amount": 1500}]}
    assert client.post("/portfolio/analyse", json=amounts).json()["weights"] == [0.25, 0.75]


def test_portfolio_validation(client: TestClient) -> None:
    def post(holdings, **extra) -> int:
        return client.post("/portfolio/simulate", json={"holdings": holdings, **extra}).status_code

    assert post([]) == 422
    assert post([{"symbol": f"S{i}", "weight": 1} for i in range(21)]) == 422
    assert post([{"symbol": "AAPL", "weight": 1}, {"symbol": "MSFT", "amount": 1}]) == 422
    assert post([{"symbol": "AAPL", "weight": 1, "amount": 1}]) == 422
    assert post([{"symbol": "AAPL"}]) == 422
    assert post([{"symbol": "AAPL", "weight": 1}, {"symbol": "aapl", "weight": 1}]) == 422
    assert post([{"symbol": "AAPL", "weight": 1}], n_sims=20_000) == 422
    assert post([{"symbol": "AAPL", "weight": 1}], horizon_years=0) == 422
    assert post([{"symbol": "AAPL", "weight": 1}], period="3mo") == 422
    assert (
        client.post(
            "/portfolio/analyse", json={"holdings": [{"symbol": "NOPE", "weight": 1}]}
        ).status_code
        == 404
    )


def test_portfolio_simulate_is_seeded_and_shaped(client: TestClient) -> None:
    body = {
        "holdings": [{"symbol": "AAPL", "weight": 1}, {"symbol": "MSFT", "weight": 1}],
        "period": "1y",
        "horizon_years": 5,
        "n_sims": 200,
        "initial_value": 1000,
        "monthly_contribution": 100,
        "seed": 42,
    }
    a = client.post("/portfolio/simulate", json=body)
    assert a.status_code == 200, a.text
    out = a.json()
    assert out["steps_per_year"] == 52 and out["horizon_years"] == 5 and out["n_sims"] == 200
    assert len(out["times"]) <= 260 and out["times"][-1] == 5.0
    assert set(out["bands"]) == {"p5", "p25", "p50", "p75", "p95"}
    assert len(out["bands"]["p50"]) == len(out["times"])
    assert out["bands"]["p50"][0] == 1000
    t = out["terminal"]
    assert {"mean", "median", "p5", "p95", "prob_loss", "var_95", "var_95_pct", "cvar_95"} <= set(t)
    assert out["stats"]["symbols"] == ["AAPL", "MSFT"]
    assert client.post("/portfolio/simulate", json=body).json() == out  # same seed, same paths
    assert client.post("/portfolio/simulate", json={**body, "seed": 43}).json() != out


RETIRE = {
    "current_age": 40,
    "retirement_age": 65,
    "life_expectancy": 90,
    "current_savings": 150_000,
    "monthly_contribution": 1_000,
    "expected_return": 0.06,
    "inflation": 0.025,
    "annual_spending": 50_000,
    "n_sims": 300,
    "seed": 3,
}


def test_retirement_project_parametric(client: TestClient) -> None:
    r = client.post("/retirement/project", json=RETIRE)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["assumptions"] == {"mu": 0.06, "sigma": 0.12, "source": "parametric", "symbols": []}
    det = out["deterministic"]
    assert det[0]["age"] == 40 and det[-1]["age"] == 90 and len(det) == 51
    assert det[1]["balance_nominal"] == pytest.approx(150_000 * 1.06 + 12_000)
    assert det[25]["cashflow"] == 12_000 and det[26]["cashflow"] < 0
    mc = out["monte_carlo"]
    assert 0 <= mc["success_probability"] <= 1
    assert mc["ages"] == list(range(40, 91))
    assert set(mc["bands"]) == {"p5", "p25", "p50", "p75", "p95"}
    assert mc["n_sims"] == 300
    assert client.post("/retirement/project", json=RETIRE).json() == out  # seeded


def test_retirement_project_portfolio_mode(client: TestClient) -> None:
    body = {
        **RETIRE,
        "mode": "portfolio",
        "holdings": [{"symbol": "AAPL", "weight": 1}, {"symbol": "MSFT", "weight": 1}],
    }
    r = client.post("/retirement/project", json=body)
    assert r.status_code == 200, r.text
    a = r.json()["assumptions"]
    assert a["source"] == "portfolio" and a["symbols"] == ["AAPL", "MSFT"]
    assert a["sigma"] > 0 and -0.5 <= a["mu"] <= 0.5  # derived moments are clamped


def test_retirement_validation(client: TestClient) -> None:
    post = lambda **kw: client.post("/retirement/project", json={**RETIRE, **kw}).status_code  # noqa: E731
    assert post(retirement_age=40) == 422
    assert post(life_expectancy=65) == 422
    assert post(life_expectancy=120) == 422
    assert post(expected_return=0.9) == 422
    assert post(n_sims=50_000) == 422
    assert post(mode="portfolio") == 422  # no holdings
    assert post(mode="portfolio", holdings=[{"symbol": "NOPE", "weight": 1}]) == 404
    assert post(current_savings=-5) == 422


def test_cors_allows_dev_origin(client: TestClient) -> None:
    r = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
