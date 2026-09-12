import math

import numpy as np
import pandas as pd
import pytest

from app.services import indicators as ind
from app.services.indicators import (
    DEFAULT_EMA_SPANS,
    DEFAULT_TOKENS,
    MAX_INDICATORS_PER_REQUEST,
    REGISTRY,
    IndicatorError,
    bollinger,
    compute_emas,
    ema,
    sma,
)
from tests.fakes import make_ohlc


@pytest.fixture
def closes() -> pd.Series:
    return pd.Series(np.arange(1, 31, dtype=float), name="Close")


def frame(
    close: list[float],
    high: list[float] | None = None,
    low: list[float] | None = None,
    volume: list[float] | None = None,
) -> pd.DataFrame:
    c = np.asarray(close, dtype=float)
    return pd.DataFrame(
        {
            "Open": c,
            "High": np.asarray(high, dtype=float) if high is not None else c + 1,
            "Low": np.asarray(low, dtype=float) if low is not None else c - 1,
            "Close": c,
            "Volume": np.asarray(volume, dtype=float)
            if volume is not None
            else np.full(len(c), 100.0),
        }
    )


def reference_ema(values: list[float], span: int) -> list[float]:
    """Independent textbook EMA: seed with the first value, alpha = 2 / (span + 1)."""
    alpha = 2 / (span + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(alpha * v + (1 - alpha) * out[-1])
    return out


# -- building blocks ----------------------------------------------------------------------------


@pytest.mark.parametrize("span", DEFAULT_EMA_SPANS)
def test_ema_matches_reference(closes: pd.Series, span: int) -> None:
    got = ema(closes, span).tolist()
    want = reference_ema(closes.tolist(), span)
    assert got == pytest.approx(want)
    assert ema(closes, span).name == f"ema_{span}"


def test_ema_hand_values(closes: pd.Series) -> None:
    # span 10 -> alpha 2/11. ema[1] = 1 + (2/11)(2 - 1) = 13/11.
    got = ema(closes, 10)
    assert got.iloc[0] == 1.0
    assert got.iloc[1] == pytest.approx(13 / 11)


def test_ema_rejects_bad_span(closes: pd.Series) -> None:
    with pytest.raises(ValueError):
        ema(closes, 0)


def test_sma_window_and_nans(closes: pd.Series) -> None:
    got = sma(closes, 5)
    assert got.iloc[:4].isna().all()
    assert got.iloc[4] == 3.0  # mean(1..5)
    assert got.iloc[-1] == 28.0  # mean(26..30)
    with pytest.raises(ValueError):
        sma(closes, 0)


def test_bollinger_hand_values(closes: pd.Series) -> None:
    bands = bollinger(closes, window=20, k=2)
    assert list(bands.columns) == ["middle", "upper", "lower"]
    assert bands.iloc[:19].isna().all().all()
    # Window 1..20: mean 10.5, population std sqrt((20^2 - 1) / 12).
    std = math.sqrt((20**2 - 1) / 12)
    assert bands["middle"].iloc[19] == pytest.approx(10.5)
    assert bands["upper"].iloc[19] == pytest.approx(10.5 + 2 * std)
    assert bands["lower"].iloc[19] == pytest.approx(10.5 - 2 * std)
    with pytest.raises(ValueError):
        bollinger(closes, window=1)


def test_compute_emas_columns(closes: pd.Series) -> None:
    out = compute_emas(closes)
    assert list(out.columns) == ["10", "30", "60", "90"]


def test_wilder_seeds_with_simple_mean() -> None:
    got = ind.wilder(pd.Series([1.0, 2.0, 3.0, 4.0]), 2).tolist()
    assert math.isnan(got[0])
    assert got[1:] == pytest.approx([1.5, 2.25, 3.125])
    assert ind.wilder(pd.Series([1.0]), 2).isna().all()


def test_true_range_uses_previous_close() -> None:
    tr = ind.true_range(frame([9, 11], high=[10, 12], low=[8, 9])).tolist()
    assert tr[0] == 2.0  # no previous close: high - low
    assert tr[1] == 3.0  # max(12-9, |12-9|, |9-9|)


# -- overlays ---------------------------------------------------------------------------------


def test_vwap_without_sessions_is_cumulative() -> None:
    df = frame([10, 20, 30], high=[10, 20, 30], low=[10, 20, 30], volume=[1, 1, 2])
    got = ind.vwap(df, per_session=False)["vwap"].tolist()
    assert got == pytest.approx([10, 15, (10 + 20 + 60) / 4])


def test_vwap_resets_each_session_on_intraday_bars() -> None:
    idx = pd.to_datetime(
        ["2026-03-02 10:00", "2026-03-02 11:00", "2026-03-03 10:00", "2026-03-03 11:00"], utc=True
    )
    df = frame([10, 20, 5, 15], high=[10, 20, 5, 15], low=[10, 20, 5, 15]).set_index(idx)
    got = ind.vwap(df)["vwap"].tolist()
    assert got == pytest.approx([10, 15, 5, 10])


def test_psar_trails_below_a_rising_market_and_above_a_falling_one() -> None:
    rising = frame(list(range(10, 40)))
    sar = ind.psar(rising)["sar"]
    assert math.isnan(sar.iloc[0])
    assert (sar.iloc[1:] < rising["Low"].iloc[1:]).all()
    assert sar.iloc[2:].diff().dropna().ge(0).all()  # keeps ratcheting up
    falling = frame(list(range(40, 10, -1)))
    sar_f = ind.psar(falling)["sar"]
    # First bar is assumed rising; the drop below its SAR flips it to falling on bar 1 or 2.
    assert (sar_f.iloc[3:] > falling["High"].iloc[3:]).all()
    assert ind.psar(frame([1.0]))["sar"].isna().all()


def test_ichimoku_shifts_and_constant_input() -> None:
    n = 120
    df = frame([50.0] * n, high=[51.0] * n, low=[49.0] * n)
    out = ind.ichimoku(df)
    assert list(out.columns) == ["tenkan", "kijun", "senkou_a", "senkou_b", "chikou"]
    assert out["tenkan"].iloc[8] == 50 and out["tenkan"].iloc[:8].isna().all()
    assert out["kijun"].iloc[25] == 50 and out["kijun"].iloc[:25].isna().all()
    assert out["senkou_a"].iloc[: 25 + 26].isna().all() and out["senkou_a"].iloc[51] == 50
    assert out["senkou_b"].iloc[: 51 + 26].isna().all() and out["senkou_b"].iloc[77] == 50
    assert out["chikou"].iloc[-26:].isna().all() and out["chikou"].iloc[0] == 50


def test_keltner_and_donchian_are_ordered() -> None:
    df = make_ohlc(80)
    k = ind.keltner(df).dropna()
    assert (k["upper"] >= k["middle"]).all() and (k["middle"] >= k["lower"]).all()
    d = ind.donchian(df, 20).dropna()
    assert (d["upper"] >= d["middle"]).all() and (d["middle"] >= d["lower"]).all()
    assert d["upper"].iloc[0] == df["High"].iloc[:20].max()
    assert d["lower"].iloc[0] == df["Low"].iloc[:20].min()


def test_pivots_hand_values() -> None:
    out = ind.pivots(frame([9, 9.5], high=[10, 10], low=[8, 9]))
    assert out.iloc[0].isna().all()
    assert out.iloc[1].to_dict() == pytest.approx({"pp": 9, "r1": 10, "s1": 8, "r2": 11, "s2": 7})


# -- oscillators ------------------------------------------------------------------------------


def test_rsi_extremes_and_range() -> None:
    up = ind.rsi(frame(list(range(1, 40))), 14)["rsi"]
    assert up.iloc[:14].isna().all()
    assert (up.iloc[14:] == 100).all()
    down = ind.rsi(frame(list(range(40, 1, -1))), 14)["rsi"]
    assert (down.iloc[14:] == 0).all()
    mixed = ind.rsi(make_ohlc(120), 14)["rsi"].dropna()
    assert mixed.between(0, 100).all() and 0 < mixed.iloc[-1] < 100


def test_rsi_matches_hand_computation() -> None:
    closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84]
    got = ind.rsi(frame(closes), 4)["rsi"]
    # Wilder: seed = simple mean of the first 4 gains/losses (bars 1..4), then smoothed.
    deltas = np.diff(closes)
    gains = np.clip(deltas, 0, None)
    losses = np.clip(-deltas, 0, None)
    ag, al = gains[:4].mean(), losses[:4].mean()
    want = [100 - 100 / (1 + ag / al)]
    for g, lo in zip(gains[4:], losses[4:], strict=True):
        ag = ag + (g - ag) / 4
        al = al + (lo - al) / 4
        want.append(100 - 100 / (1 + ag / al))
    assert got.iloc[:4].isna().all()
    assert got.iloc[4:].tolist() == pytest.approx(want)


def test_macd_matches_reference_emas(closes: pd.Series) -> None:
    df = frame(closes.tolist())
    out = ind.macd(df, 5, 10, 3)
    fast = np.array(reference_ema(closes.tolist(), 5))
    slow = np.array(reference_ema(closes.tolist(), 10))
    line = fast - slow
    assert out["macd"].tolist() == pytest.approx(line.tolist())
    assert out["signal"].tolist() == pytest.approx(reference_ema(line.tolist(), 3))
    assert out["hist"].tolist() == pytest.approx((out["macd"] - out["signal"]).tolist())
    with pytest.raises(IndicatorError):
        ind.macd(df, 20, 5)


def test_stochastic_hits_100_when_close_is_the_high() -> None:
    c = list(range(1, 30))
    df = frame(c, high=c, low=[x - 1 for x in c])
    out = ind.stochastic(df, k=5, d=1, smooth=1)
    assert out["k"].iloc[:4].isna().all()
    assert (out["k"].iloc[4:] == 100).all() and (out["d"].iloc[4:] == 100).all()
    mixed = ind.stochastic(make_ohlc(120)).dropna()
    assert mixed["k"].between(0, 100).all() and mixed["d"].between(0, 100).all()


def test_adx_ranges_and_direction() -> None:
    rising = ind.adx(frame(list(range(1, 80))), 14).dropna()
    assert (rising["plus_di"] > rising["minus_di"]).all()
    assert rising["adx"].between(0, 100).all()
    out = ind.adx(make_ohlc(120), 14)
    assert out["plus_di"].iloc[:14].isna().all() and out["plus_di"].iloc[14:].notna().all()
    assert (
        out["adx"].iloc[: 2 * 14 - 1].isna().all() and out["adx"].iloc[2 * 14 - 1 :].notna().all()
    )
    assert out.dropna()["adx"].between(0, 100).all()


def test_atr_constant_bars() -> None:
    n = 30
    out = ind.atr(frame([10.0] * n, high=[11.0] * n, low=[9.0] * n), 14)["atr"]
    assert out.iloc[:13].isna().all()
    assert (out.iloc[13:] == 2.0).all()


def test_cci_constant_is_undefined_and_random_is_finite() -> None:
    n = 40
    assert ind.cci(frame([10.0] * n, high=[10.0] * n, low=[10.0] * n))["cci"].isna().all()
    out = ind.cci(make_ohlc(120))["cci"]
    assert out.iloc[:19].isna().all() and np.isfinite(out.iloc[19:]).all()


def test_obv_hand_values() -> None:
    out = ind.obv(frame([1, 2, 1, 1, 3], volume=[10, 20, 30, 40, 50]))["obv"].tolist()
    assert out == [0, 20, -10, -10, 40]


def test_williams_r_extremes() -> None:
    c = list(range(1, 30))
    at_high = ind.williams_r(frame(c, high=c, low=[x - 1 for x in c]), 5)["willr"]
    assert (at_high.iloc[4:] == 0).all()
    falling = list(range(30, 1, -1))
    at_low = ind.williams_r(frame(falling, high=[x + 1 for x in falling], low=falling), 5)["willr"]
    assert (at_low.iloc[4:] == -100).all()


def test_mfi_range_and_saturation() -> None:
    rising = ind.mfi(frame(list(range(1, 40))), 14)["mfi"]
    assert rising.iloc[:14].isna().all() and (rising.iloc[14:] == 100).all()
    mixed = ind.mfi(make_ohlc(120), 14)["mfi"].dropna()
    assert mixed.between(0, 100).all()


def test_roc_hand_values(closes: pd.Series) -> None:
    out = ind.roc(frame(closes.tolist()), 12)["roc"]
    assert out.iloc[:12].isna().all()
    assert out.iloc[12] == pytest.approx(1200.0)  # (13 - 1) / 1
    assert out.iloc[-1] == pytest.approx(100 * (30 - 18) / 18)


# -- registry ---------------------------------------------------------------------------------


def test_registry_has_the_twenty_one() -> None:
    assert len(REGISTRY) == 21
    kinds = [s.kind for s in REGISTRY.values()]
    assert kinds.count("overlay") == 11 and kinds.count("pane") == 10
    assert set(DEFAULT_TOKENS) <= {ind.parse_token(t).token for t in DEFAULT_TOKENS}


@pytest.mark.parametrize("spec_id", sorted(REGISTRY))
def test_every_indicator_computes_its_outputs(spec_id: str) -> None:
    df = make_ohlc(80)
    req = ind.parse_token(spec_id)
    out = ind.compute(req, df)
    assert list(out.columns) == list(req.spec.outputs)
    assert len(out) == len(df)
    for col in out.columns:
        assert out[col].notna().any(), f"{spec_id}.{col} is all NaN"


def test_catalog_shape() -> None:
    cat = ind.catalog()
    assert [c["id"] for c in cat] == list(REGISTRY)
    rsi_spec = next(c for c in cat if c["id"] == "rsi")
    assert rsi_spec["params"] == [
        {"name": "period", "default": 14, "min": 2, "max": 200, "integer": True}
    ]
    assert rsi_spec["reference_lines"] == [30, 70]
    assert rsi_spec["kind"] == "pane" and rsi_spec["formula"]


def test_parse_token_canonical_forms() -> None:
    assert ind.parse_token("rsi").token == "rsi:14"
    assert ind.parse_token("RSI:21").token == "rsi:21"
    assert ind.parse_token("macd:5-20").token == "macd:5-20-9"
    assert ind.parse_token("bb:20-2.5").token == "bb:20-2.5"
    assert ind.parse_token("bb").params == {"window": 20, "k": 2.0}
    assert ind.parse_token("psar:0.03").token == "psar:0.03-0.2"
    assert ind.parse_token("sr").token == "sr" and ind.parse_token("obv").token == "obv"


@pytest.mark.parametrize(
    "bad",
    ["nope", "rsi:1", "rsi:999", "rsi:x", "rsi:14-3", "macd:20-5", "obv:3", "bb:20-2-2"],
)
def test_parse_token_rejects(bad: str) -> None:
    with pytest.raises(IndicatorError):
        ind.parse_token(bad)


def test_parse_tokens_defaults_dedupes_and_caps() -> None:
    assert [r.token for r in ind.parse_tokens(None)] == list(DEFAULT_TOKENS)
    assert [r.token for r in ind.parse_tokens("")] == list(DEFAULT_TOKENS)
    assert [r.token for r in ind.parse_tokens("rsi, RSI:14 ,sma:50,,")] == ["rsi:14", "sma:50"]
    too_many = ",".join(f"sma:{n}" for n in range(2, 2 + MAX_INDICATORS_PER_REQUEST + 1))
    with pytest.raises(IndicatorError, match="At most"):
        ind.parse_tokens(too_many)
