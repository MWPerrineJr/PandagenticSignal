import pandas as pd
import pytest

from app.errors import RateLimitedError, TickerNotFoundError, UpstreamError
from app.services.market_data import MarketData, frame_to_candles, normalise_ticker
from tests.fakes import FakeTicker, FakeYF, make_ohlc


def test_normalise_ticker() -> None:
    assert normalise_ticker("  aapl ") == "AAPL"


# -- search ---------------------------------------------------------------------------------


def test_search_keeps_equities_etfs_and_crypto(market_data: MarketData) -> None:
    results = market_data.search("apple")
    symbols = [r.symbol for r in results]
    assert symbols == ["AAPL", "APC.DE", "QQQ", "BTC-USD"]  # options and futures are dropped
    assert results[3].type == "CRYPTOCURRENCY"
    assert results[3].exchange == "CCC"
    assert results[0].name == "Apple Inc."
    assert results[0].exchange == "NASDAQ"
    assert results[1].name == "Apple Inc."  # falls back to longname
    assert results[1].exchange == "GER"
    assert results[2].type == "ETF"


def test_search_respects_limit_and_blank_query(market_data: MarketData) -> None:
    assert len(market_data.search("apple", limit=2)) == 2
    assert market_data.search("   ") == []
    assert market_data.search("zzz") == []


def test_search_is_cached_case_insensitively(market_data: MarketData, fake_yf: FakeYF) -> None:
    market_data.search("Apple")
    fake_yf.fail_with_upstream()  # a second upstream call would now blow up
    assert market_data.search("apple")[0].symbol == "AAPL"


# -- quotes ---------------------------------------------------------------------------------


def test_quote_maps_fast_info(market_data: MarketData) -> None:
    q = market_data.quote("aapl")
    assert q.symbol == "AAPL"
    assert q.price == 200.0
    assert q.previous_close == 190.0
    assert q.change == pytest.approx(10.0)
    assert q.change_pct == pytest.approx(10 / 190 * 100)
    assert q.volume == 1234567
    assert q.currency == "USD"
    assert q.year_high == 260.0


def test_quote_missing_optional_fields(market_data: MarketData) -> None:
    q = market_data.quote("MSFT")
    assert q.change == 0.0
    assert q.day_high is None
    assert q.year_low is None
    assert q.quote_type is None


def test_quote_crypto_symbol(market_data: MarketData) -> None:
    q = market_data.quote("btc-usd")
    assert q.symbol == "BTC-USD"
    assert q.quote_type == "CRYPTOCURRENCY"
    assert q.exchange == "CCC"
    assert q.change_pct == pytest.approx(1000 / 64000 * 100)


# -- crypto ---------------------------------------------------------------------------------


def test_top_crypto_maps_screener_rows(market_data: MarketData) -> None:
    top = market_data.top_crypto(limit=10)
    assert isinstance(top.as_of, int)
    # The row without a price is skipped.
    assert [c.symbol for c in top.coins] == ["BTC-USD", "ETH-USD", "SOL-USD"]
    btc, eth, sol = top.coins
    assert btc.name == "Bitcoin USD"
    assert btc.price == 65000.0
    assert btc.change_pct == 1.5
    assert btc.market_cap == 1.3e12
    assert btc.volume == 31_000_000_000  # 24 h volume preferred over the session volume
    assert btc.circulating_supply == 20_000_000
    assert eth.name == "Ethereum USD"  # falls back to longName
    assert eth.volume == 12_000_000_000
    assert sol.change_pct is None and sol.volume is None and sol.circulating_supply is None


def test_top_crypto_limit_is_clamped_and_cached(market_data: MarketData, fake_yf: FakeYF) -> None:
    assert [c.symbol for c in market_data.top_crypto(limit=1).coins] == ["BTC-USD"]
    assert FakeTicker.calls[-1] == ("screen", "all_cryptocurrencies_us:1")
    assert len(market_data.top_crypto(limit=500).coins) == 3  # clamped to MAX_CRYPTO upstream
    assert FakeTicker.calls[-1] == ("screen", "all_cryptocurrencies_us:100")
    fake_yf.fail_with_upstream()
    assert len(market_data.top_crypto(limit=1).coins) == 1  # served from cache
    with pytest.raises(UpstreamError):
        market_data.top_crypto(limit=2)


def test_quote_unknown_ticker_raises_404_error(market_data: MarketData) -> None:
    with pytest.raises(TickerNotFoundError) as exc:
        market_data.quote("NOPE")
    assert exc.value.ticker == "NOPE"


def test_quote_uses_cache(market_data: MarketData) -> None:
    market_data.quote("AAPL")
    market_data.quote("aapl")
    assert FakeTicker.calls.count(("Ticker", "AAPL")) == 1


def test_quotes_batch_dedupes_and_reports_missing(market_data: MarketData) -> None:
    found, missing = market_data.quotes(["aapl", "AAPL", "msft", "", "nope"])
    assert [q.symbol for q in found] == ["AAPL", "MSFT"]
    assert missing == ["NOPE"]


# -- error translation ---------------------------------------------------------------------


def test_rate_limit_becomes_rate_limited_error(market_data: MarketData, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_rate_limit()
    with pytest.raises(RateLimitedError):
        market_data.quote("AAPL")


def test_yf_exception_becomes_upstream_error(market_data: MarketData, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_upstream()
    with pytest.raises(UpstreamError):
        market_data.history("AAPL")


def test_network_error_becomes_upstream_error(market_data: MarketData, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_network()
    with pytest.raises(UpstreamError):
        market_data.search("apple")


# -- history --------------------------------------------------------------------------------


def test_history_returns_copy_of_cached_frame(market_data: MarketData) -> None:
    first = market_data.history("AAPL", period="6mo", interval="1d")
    first["Close"] = 0.0
    second = market_data.history("AAPL", period="6mo", interval="1d")
    assert (second["Close"] != 0.0).all()
    assert FakeTicker.calls.count(("history", "AAPL:6mo:1d")) == 1


def test_history_unknown_ticker(market_data: MarketData) -> None:
    with pytest.raises(TickerNotFoundError):
        market_data.history("NOPE")


def test_frame_to_candles_converts_utc_and_skips_nan() -> None:
    df = make_ohlc(3)
    df.loc[df.index[1], "Close"] = float("nan")
    df.loc[df.index[2], "Volume"] = float("nan")
    candles = frame_to_candles(df)
    assert len(candles) == 2
    first = candles[0]
    assert first.time == int(pd.Timestamp("2026-01-02", tz="America/New_York").timestamp())
    assert candles[1].volume == 0
    assert frame_to_candles(pd.DataFrame()) == []


def test_frame_to_candles_naive_index() -> None:
    df = make_ohlc(2).tz_localize(None)
    candles = frame_to_candles(df)
    assert candles[0].time == int(pd.Timestamp("2026-01-02").timestamp())


# -- recommendations -----------------------------------------------------------------------


def test_recommendations_full(market_data: MarketData) -> None:
    rec = market_data.recommendations("aapl")
    assert rec["symbol"] == "AAPL"
    assert [p.period for p in rec["summary"]] == ["0m", "-1m"]
    assert rec["summary"][0].strong_buy == 6
    assert rec["price_targets"].mean == 225.5
    grades = rec["upgrades_downgrades"]
    assert [g.firm for g in grades] == ["Morgan Stanley", "DA Davidson", "Rosenblatt", "Needham"]
    assert grades[0].date.startswith("2026-09-02T17:34:35")
    assert grades[2].price_target_action is None
    assert grades[2].current_price_target is None
    # Yahoo encodes "no target" as 0.0; it must not surface as a $0 price.
    assert grades[3].current_price_target is None
    assert grades[3].prior_price_target is None


def test_recommendations_partial_data(market_data: MarketData) -> None:
    rec = market_data.recommendations("MSFT")
    assert rec["summary"] == []
    assert rec["price_targets"].mean is None
    assert rec["upgrades_downgrades"] == []


def test_recommendations_unknown_ticker(market_data: MarketData) -> None:
    with pytest.raises(TickerNotFoundError):
        market_data.recommendations("NOPE")


def test_recommendations_cached(market_data: MarketData, fake_yf: FakeYF) -> None:
    market_data.recommendations("AAPL")
    fake_yf.fail_with_upstream()
    assert market_data.recommendations("AAPL")["symbol"] == "AAPL"


def test_optional_dataset_swallows_upstream_error(market_data: MarketData, fake_yf: FakeYF) -> None:
    fake_yf.fail_with_upstream()
    assert market_data._optional(lambda: fake_yf.Ticker("AAPL").recommendations_summary) is None
