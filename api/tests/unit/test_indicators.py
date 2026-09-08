import math

import numpy as np
import pandas as pd
import pytest

from app.services.indicators import DEFAULT_EMA_SPANS, bollinger, compute_emas, ema, sma


@pytest.fixture
def closes() -> pd.Series:
    return pd.Series(np.arange(1, 31, dtype=float), name="Close")


def reference_ema(values: list[float], span: int) -> list[float]:
    """Independent textbook EMA: seed with the first value, alpha = 2 / (span + 1)."""
    alpha = 2 / (span + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(alpha * v + (1 - alpha) * out[-1])
    return out


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
    # Middle stays centred between the bands everywhere it is defined.
    defined = bands.dropna()
    assert ((defined["upper"] + defined["lower"]) / 2).tolist() == pytest.approx(
        defined["middle"].tolist()
    )


def test_bollinger_flat_series_collapses_bands() -> None:
    flat = pd.Series([50.0] * 25)
    bands = bollinger(flat, window=20)
    assert bands["upper"].iloc[-1] == bands["lower"].iloc[-1] == 50.0


def test_bollinger_rejects_bad_window(closes: pd.Series) -> None:
    with pytest.raises(ValueError):
        bollinger(closes, window=1)


def test_compute_emas_columns(closes: pd.Series) -> None:
    frame = compute_emas(closes)
    assert list(frame.columns) == ["10", "30", "60", "90"]
    assert len(frame) == len(closes)
    assert frame["10"].tolist() == pytest.approx(ema(closes, 10).tolist())
