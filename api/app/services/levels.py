"""Support / resistance detection from local price extrema."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd
from scipy.signal import argrelextrema

Kind = Literal["support", "resistance"]


@dataclass(frozen=True)
class Level:
    price: float
    touches: int
    kind: Kind


def _extrema_prices(df: pd.DataFrame, order: int) -> np.ndarray:
    highs = df["High"].to_numpy(dtype=float)
    lows = df["Low"].to_numpy(dtype=float)
    max_idx = argrelextrema(highs, np.greater_equal, order=order)[0]
    min_idx = argrelextrema(lows, np.less_equal, order=order)[0]
    return np.concatenate([highs[max_idx], lows[min_idx]])


def _cluster(prices: np.ndarray, tolerance: float) -> list[tuple[float, int]]:
    """Greedily group sorted prices whose distance from the running cluster mean is within
    `tolerance` (fraction). Returns (mean_price, count) per cluster."""
    clusters: list[tuple[float, int]] = []
    current: list[float] = []
    for price in np.sort(prices):
        if current and abs(price - np.mean(current)) / np.mean(current) > tolerance:
            clusters.append((float(np.mean(current)), len(current)))
            current = []
        current.append(float(price))
    if current:
        clusters.append((float(np.mean(current)), len(current)))
    return clusters


def support_resistance(
    df: pd.DataFrame,
    *,
    order: int = 5,
    tolerance: float = 0.02,
    max_levels: int = 6,
) -> list[Level]:
    """Find the strongest horizontal price levels in an OHLC frame.

    Local maxima of `High` and minima of `Low` (a bar is an extremum if it is the most extreme
    within `order` bars on each side) are clustered when within `tolerance` of each other. Each
    cluster becomes a level ranked by touch count. A level is labelled `resistance` when above
    the last close and `support` when at or below it.
    """
    if df.empty or len(df) < 2 * order + 1:
        return []
    prices = _extrema_prices(df, order)
    prices = prices[np.isfinite(prices)]
    if prices.size == 0:
        return []
    last_close = float(df["Close"].iloc[-1])
    clusters = _cluster(prices, tolerance)
    clusters.sort(key=lambda c: (-c[1], abs(c[0] - last_close)))
    return [
        Level(
            price=round(price, 4),
            touches=count,
            kind="resistance" if price > last_close else "support",
        )
        for price, count in clusters[:max_levels]
    ]
