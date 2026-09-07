"""Pure-pandas technical indicators. No network, no yfinance."""

from __future__ import annotations

import pandas as pd

DEFAULT_EMA_SPANS: tuple[int, ...] = (10, 30, 60, 90)


def ema(close: pd.Series, span: int) -> pd.Series:
    """Exponential moving average with the standard `2 / (span + 1)` smoothing factor."""
    if span < 1:
        raise ValueError("span must be >= 1")
    return close.ewm(span=span, adjust=False).mean().rename(f"ema_{span}")


def sma(close: pd.Series, window: int) -> pd.Series:
    if window < 1:
        raise ValueError("window must be >= 1")
    return close.rolling(window=window, min_periods=window).mean().rename(f"sma_{window}")


def bollinger(close: pd.Series, window: int = 20, k: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands: SMA middle line with upper/lower at ± k population standard deviations.

    Values are NaN until `window` observations are available.
    """
    if window < 2:
        raise ValueError("window must be >= 2")
    middle = sma(close, window)
    std = close.rolling(window=window, min_periods=window).std(ddof=0)
    return pd.DataFrame(
        {
            "middle": middle,
            "upper": middle + k * std,
            "lower": middle - k * std,
        }
    )


def compute_emas(close: pd.Series, spans: tuple[int, ...] = DEFAULT_EMA_SPANS) -> pd.DataFrame:
    return pd.DataFrame({str(span): ema(close, span) for span in spans})
