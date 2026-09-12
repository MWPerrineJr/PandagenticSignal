import numpy as np
import pandas as pd
import pytest

from app.services.levels import Level, fib_retracement, support_resistance


def oscillating_frame(cycles: int = 4, period: int = 20) -> pd.DataFrame:
    """Price bounces between ~90 and ~110 so the extrema are unambiguous."""
    n = cycles * period
    x = np.arange(n)
    close = 100 + 10 * np.sin(2 * np.pi * x / period)
    high = close + 0.5
    low = close - 0.5
    return pd.DataFrame({"Open": close, "High": high, "Low": low, "Close": close})


def test_detects_two_dominant_levels() -> None:
    df = oscillating_frame()
    levels = support_resistance(df, order=5, tolerance=0.02)
    assert levels
    prices = sorted(lv.price for lv in levels)
    assert any(abs(p - 89.5) < 1 for p in prices)
    assert any(abs(p - 110.5) < 1 for p in prices)
    top = levels[0]
    assert top.touches >= 3
    assert isinstance(top, Level)


def test_kind_is_relative_to_last_close() -> None:
    df = oscillating_frame()
    last_close = df["Close"].iloc[-1]
    for lv in support_resistance(df):
        expected = "resistance" if lv.price > last_close else "support"
        assert lv.kind == expected


def test_levels_ranked_by_touches_then_limited() -> None:
    df = oscillating_frame(cycles=6)
    levels = support_resistance(df, max_levels=1)
    assert len(levels) == 1
    all_levels = support_resistance(df, max_levels=10)
    touches = [lv.touches for lv in all_levels]
    assert touches == sorted(touches, reverse=True)


def test_flat_series_yields_single_cluster() -> None:
    df = pd.DataFrame({"Open": 50.0, "High": 50.0, "Low": 50.0, "Close": 50.0}, index=range(40))
    levels = support_resistance(df, order=5)
    assert len(levels) == 1
    assert levels[0].price == 50.0
    assert levels[0].kind == "support"


def test_too_few_rows_returns_empty() -> None:
    df = oscillating_frame().head(8)
    assert support_resistance(df, order=5) == []
    assert support_resistance(df.iloc[0:0]) == []


def test_nan_rows_are_ignored() -> None:
    df = oscillating_frame()
    df.loc[df.index[10], ["High", "Low"]] = np.nan
    levels = support_resistance(df)
    assert all(np.isfinite(lv.price) for lv in levels)


def test_tolerance_merges_nearby_levels() -> None:
    df = oscillating_frame()
    tight = support_resistance(df, tolerance=0.0001, max_levels=50)
    loose = support_resistance(df, tolerance=0.05, max_levels=50)
    assert len(loose) <= len(tight)


def trending_frame(low: float, high: float, n: int = 30, uptrend: bool = True) -> pd.DataFrame:
    """A straight ramp from `low` to `high` (or the reverse), so the swing is unambiguous."""
    x = np.linspace(0, 1, n)
    close = low + x * (high - low) if uptrend else high - x * (high - low)
    return pd.DataFrame({"Open": close, "High": close + 0.01, "Low": close - 0.01, "Close": close})


def test_fib_retracement_uptrend_anchors_0pct_at_the_high() -> None:
    df = trending_frame(100, 200, uptrend=True)
    levels = fib_retracement(df)
    assert [lv.kind for lv in levels] == ["fib"] * 7
    by_label = {lv.label: lv.price for lv in levels}
    assert by_label["0%"] == df["High"].max()
    assert by_label["100%"] == df["Low"].min()
    assert by_label["50%"] == pytest.approx((df["High"].max() + df["Low"].min()) / 2, abs=0.5)


def test_fib_retracement_downtrend_anchors_0pct_at_the_low() -> None:
    df = trending_frame(100, 200, uptrend=False)
    levels = fib_retracement(df)
    by_label = {lv.label: lv.price for lv in levels}
    assert by_label["0%"] == df["Low"].min()
    assert by_label["100%"] == df["High"].max()


def test_fib_retracement_flat_series_returns_empty() -> None:
    df = pd.DataFrame({"Open": 50.0, "High": 50.0, "Low": 50.0, "Close": 50.0}, index=range(10))
    assert fib_retracement(df) == []


def test_fib_retracement_empty_frame_returns_empty() -> None:
    df = pd.DataFrame({"Open": [], "High": [], "Low": [], "Close": []})
    assert fib_retracement(df) == []
