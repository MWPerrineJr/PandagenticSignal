import httpx
import pandas as pd
import pytest

from app.errors import RateLimitedError, TickerNotFoundError, UpstreamError
from app.services.cache import Cache
from app.services.crypto import (
    CANDLES_PER_REQUEST,
    MAX_CANDLE_REQUESTS,
    CryptoData,
    NotFound,
    base_symbol,
    make_fetcher,
)
from app.settings import Settings
from tests.fakes import FAKE_NOW, FakeFetch


def test_base_symbol() -> None:
    assert base_symbol(" btc-usd ") == "BTC"
    assert base_symbol("AAPL") is None
    assert base_symbol("BTC-EUR") is None
    assert base_symbol("-USD") is None


# -- products / membership --------------------------------------------------------------------


def test_products_keep_online_usd_spot_pairs_and_cache(
    crypto: CryptoData, fake_fetch: FakeFetch
) -> None:
    products = crypto.products()
    assert set(products) == {"BTC", "ETH", "DOGE"}  # EUR pair, delisted and disabled dropped
    assert products["BTC"]["name"] == "Bitcoin"
    assert products["BTC"]["price"] == 65000.0
    assert products["DOGE"]["change_pct"] is None  # blank strings read as missing
    crypto.products()
    assert len(fake_fetch.urls("/products")) == 1


def test_is_crypto(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    assert crypto.is_crypto("AAPL") is False
    assert fake_fetch.calls == []  # no network for non-USD pairs
    assert crypto.is_crypto("btc-usd") is True
    assert crypto.is_crypto("NOPE-USD") is False


def test_is_crypto_reads_false_when_coinbase_is_unreachable(
    crypto: CryptoData, fake_fetch: FakeFetch
) -> None:
    fake_fetch.error = UpstreamError("down")
    assert crypto.is_crypto("BTC-USD") is False
    fake_fetch.error = RateLimitedError("slow down")
    assert crypto.is_crypto("BTC-USD") is False


# -- quotes ---------------------------------------------------------------------------------


def test_quote_maps_coinbase_product_and_coingecko_market_cap(crypto: CryptoData) -> None:
    q = crypto.quote("btc-usd")
    assert q.symbol == "BTC-USD"
    assert q.price == 65000.0
    assert q.change_pct == 1.5
    assert q.previous_close == pytest.approx(65000 / 1.015)
    assert q.change == pytest.approx(65000 - 65000 / 1.015)
    assert q.volume == 31_000_000_000
    assert q.market_cap == 1.3e12
    assert q.currency == "USD"
    assert q.exchange == "Coinbase"
    assert q.day_high == 66000.0 and q.day_low == 63500.0
    assert q.year_high is not None and q.year_low is not None and q.year_low < q.year_high
    assert q.quote_type == "CRYPTOCURRENCY"


def test_quote_without_24h_stats_or_market_cap(crypto: CryptoData) -> None:
    q = crypto.quote("DOGE-USD")
    assert q.price == 0.1234
    assert q.previous_close is None and q.change is None and q.change_pct is None
    assert q.volume is None and q.day_high is None
    assert q.market_cap == 1.8e10


def test_quote_unknown_product(crypto: CryptoData) -> None:
    with pytest.raises(TickerNotFoundError):
        crypto.quote("NOPE-USD")
    with pytest.raises(TickerNotFoundError):
        crypto.quote("AAPL")


def test_quote_survives_missing_year_range_and_market_cap(
    crypto: CryptoData, fake_fetch: FakeFetch
) -> None:
    crypto.products()  # prime the product list, then break everything else
    fake_fetch.error = UpstreamError("down")
    q = crypto.quote("BTC-USD")
    assert q.price == 65000.0
    assert q.year_high is None and q.market_cap is None


def test_quote_is_cached(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    crypto.quote("BTC-USD")
    n = len(fake_fetch.calls)
    crypto.quote("btc-usd")
    assert len(fake_fetch.calls) == n


# -- history --------------------------------------------------------------------------------


def test_history_daily_frame_shape(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    df = crypto.history("BTC-USD", period="1mo", interval="1d")
    assert list(df.columns) == ["Open", "High", "Low", "Close", "Volume"]
    assert isinstance(df.index, pd.DatetimeIndex) and str(df.index.tz) == "UTC"
    assert df.index.is_monotonic_increasing
    assert 30 <= len(df) <= 31
    assert (df["Low"] <= df["Close"]).all() and (df["Close"] <= df["High"]).all()
    assert len(fake_fetch.urls("/candles")) == 1
    _, params = fake_fetch.calls[-1]
    assert params["granularity"] == "ONE_DAY" and params["end"] == FAKE_NOW


def test_history_pages_backwards_and_dedupes(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    df = crypto.history("BTC-USD", period="2y", interval="1d")
    assert len(fake_fetch.urls("/candles")) == 3  # 730 days / 300 per request
    assert df.index.is_unique
    assert 729 <= len(df) <= 732


def test_history_caps_the_request_count(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    df = crypto.history("BTC-USD", period="1y", interval="1m")
    assert len(fake_fetch.urls("/candles")) == MAX_CANDLE_REQUESTS
    assert len(df) <= MAX_CANDLE_REQUESTS * CANDLES_PER_REQUEST + 1
    assert df.index[-1].timestamp() <= FAKE_NOW


def test_history_resamples_weekly_and_monthly(crypto: CryptoData) -> None:
    daily = crypto.history("ETH-USD", period="6mo", interval="1d")
    weekly = crypto.history("ETH-USD", period="6mo", interval="1wk")
    monthly = crypto.history("ETH-USD", period="6mo", interval="1mo")
    assert 25 <= len(weekly) <= 28
    assert 6 <= len(monthly) <= 7
    assert weekly["High"].max() == daily["High"].max()
    assert weekly["Volume"].sum() == pytest.approx(daily["Volume"].sum())


def test_history_ytd_starts_on_jan_1(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    df = crypto.history("BTC-USD", period="ytd", interval="1d")
    assert df.index[0].year == 2026
    starts = [p["start"] for _, p in fake_fetch.calls if p and "granularity" in p]
    assert min(starts) == int(pd.Timestamp("2026-01-01", tz="UTC").timestamp())


def test_history_unknown_product_and_cached_copy(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    with pytest.raises(TickerNotFoundError):
        crypto.history("NOPE-USD")
    first = crypto.history("BTC-USD", period="1mo")
    first["Close"] = 0.0
    second = crypto.history("BTC-USD", period="1mo")
    assert (second["Close"] != 0.0).all()
    assert len(fake_fetch.urls("/candles")) == 2  # NOPE + one real fetch


# -- top coins ------------------------------------------------------------------------------


def test_top_joins_coingecko_ranking_with_coinbase_prices(crypto: CryptoData) -> None:
    top = crypto.top(limit=10)
    assert top.as_of == FAKE_NOW
    assert [c.symbol for c in top.coins] == ["BTC-USD", "ETH-USD", "USDT-USD", "DOGE-USD"]
    btc, eth, usdt, doge = top.coins
    assert btc.rank == 1 and btc.name == "Bitcoin" and btc.icon == "https://img.example/btc.png"
    assert btc.price == 65000.0 and btc.change_pct == 1.5  # Coinbase, not CoinGecko's 64990
    assert btc.volume == 31_000_000_000.5 and btc.high_24h == 66000.0
    assert btc.market_cap == 1.3e12 and btc.circulating_supply == 20_000_000.0
    assert btc.price_source == "coinbase"
    assert eth.price_source == "coinbase" and eth.price == 3200.0
    assert usdt.price_source == "coingecko" and usdt.price == 0.9996  # not on Coinbase
    assert usdt.change_pct == -0.003 and usdt.volume == 8e10 and usdt.high_24h == 1.0
    assert doge.price == 0.1234 and doge.icon is None


def test_top_limit_and_cache(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    assert [c.symbol for c in crypto.top(limit=1).coins] == ["BTC-USD"]
    assert len(crypto.top(limit=500).coins) == 4
    n = len(fake_fetch.calls)
    crypto.top(limit=1)
    assert len(fake_fetch.calls) == n
    assert len(fake_fetch.urls("/coins/markets")) == 1  # one CoinGecko page serves every limit


def test_top_uses_coingecko_prices_when_coinbase_is_down(
    crypto: CryptoData, fake_fetch: FakeFetch
) -> None:
    crypto._markets()  # prime CoinGecko, then break Coinbase
    fake_fetch.error = UpstreamError("coinbase down")
    top = crypto.top(limit=2)
    assert [c.price_source for c in top.coins] == ["coingecko", "coingecko"]
    assert top.coins[0].price == 64990


def test_top_propagates_coingecko_errors(crypto: CryptoData, fake_fetch: FakeFetch) -> None:
    fake_fetch.error = RateLimitedError("slow down")
    with pytest.raises(RateLimitedError):
        crypto.top()
    fake_fetch.error = UpstreamError("boom")
    with pytest.raises(UpstreamError):
        crypto.top()


# -- fetcher --------------------------------------------------------------------------------


def _fetcher(handler, **settings):
    return make_fetcher(Settings(**settings), transport=httpx.MockTransport(handler))


def test_fetcher_returns_json_and_sends_params() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["ua"] = request.headers["user-agent"]
        seen["key"] = request.headers.get("x-cg-demo-api-key")
        return httpx.Response(200, json={"ok": True})

    fetch = _fetcher(handler, coingecko_api_key="demo-123")
    assert fetch("https://api.coingecko.com/api/v3/coins/markets", {"page": 1}) == {"ok": True}
    assert seen["url"].endswith("/coins/markets?page=1")
    assert seen["ua"].startswith("PandagenticSignal/")
    assert seen["key"] == "demo-123"
    fetch("https://api.coinbase.com/api/v3/brokerage/market/products")
    assert seen["key"] is None  # the CoinGecko key never leaks to Coinbase


def test_fetcher_maps_http_failures() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        code = int(request.url.params["code"])
        return httpx.Response(code, text="nope")

    fetch = _fetcher(handler)
    with pytest.raises(NotFound):
        fetch("https://api.coinbase.com/x", {"code": 404})
    with pytest.raises(RateLimitedError):
        fetch("https://api.coinbase.com/x", {"code": 429})
    with pytest.raises(UpstreamError, match="returned 500"):
        fetch("https://api.coinbase.com/x", {"code": 500})


def test_fetcher_maps_network_and_json_errors() -> None:
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route", request=request)

    with pytest.raises(UpstreamError, match="Could not reach"):
        _fetcher(boom)("https://api.coinbase.com/x")

    with pytest.raises(UpstreamError, match="malformed"):
        _fetcher(lambda r: httpx.Response(200, text="<html>"))("https://api.coinbase.com/x")


def test_crypto_data_defaults_build_a_real_fetcher() -> None:
    data = CryptoData(cache=Cache(), settings=Settings())
    assert callable(data.fetch)
