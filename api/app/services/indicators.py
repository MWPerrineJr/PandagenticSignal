"""Pure-pandas technical indicators plus the registry that drives `/indicators`.

Every indicator is a function of an OHLCV frame (columns Open/High/Low/Close/Volume, any index)
returning a DataFrame whose columns are the spec's `outputs`, NaN during warm-up. No network.

Request tokens look like `rsi`, `rsi:14`, `macd:12-26-9`: the id, then positional parameters in
the order the spec declares them, joined by `-`. Missing parameters take their defaults.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

import numpy as np
import pandas as pd

DEFAULT_EMA_SPANS: tuple[int, ...] = (10, 30, 60, 90)
MAX_INDICATORS_PER_REQUEST = 8
DEFAULT_TOKENS: tuple[str, ...] = ("ema:10", "ema:30", "ema:60", "ema:90", "bb:20-2", "sr")

Kind = Literal["overlay", "pane"]
Number = int | float


class IndicatorError(ValueError):
    """A request token names an unknown indicator or gives a bad parameter (HTTP 422)."""


# -- building blocks --------------------------------------------------------------------------


def ema(close: pd.Series, span: int) -> pd.Series:
    """Exponential moving average with the standard `2 / (span + 1)` smoothing factor."""
    if span < 1:
        raise ValueError("span must be >= 1")
    return close.ewm(span=span, adjust=False).mean().rename(f"ema_{span}")


def sma(close: pd.Series, window: int) -> pd.Series:
    if window < 1:
        raise ValueError("window must be >= 1")
    return close.rolling(window=window, min_periods=window).mean().rename(f"sma_{window}")


def wilder(series: pd.Series, period: int) -> pd.Series:
    """Wilder's smoothing (RSI, ATR, ADX): an EMA with alpha = 1 / period, seeded by the first
    `period` values' simple mean so the warm-up matches the textbook tables."""
    values = series.to_numpy(dtype=float)
    out = np.full(len(values), np.nan)
    if len(values) < period:
        return pd.Series(out, index=series.index)
    first = np.nanmean(values[:period])
    out[period - 1] = first
    alpha = 1.0 / period
    for i in range(period, len(values)):
        out[i] = out[i - 1] + alpha * (values[i] - out[i - 1])
    return pd.Series(out, index=series.index)


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["Close"].shift(1)
    return pd.concat(
        [df["High"] - df["Low"], (df["High"] - prev_close).abs(), (df["Low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)


def bollinger(close: pd.Series, window: int = 20, k: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands: SMA middle line with upper/lower at ± k population standard deviations.

    Values are NaN until `window` observations are available.
    """
    if window < 2:
        raise ValueError("window must be >= 2")
    middle = sma(close, window)
    std = close.rolling(window=window, min_periods=window).std(ddof=0)
    return pd.DataFrame({"middle": middle, "upper": middle + k * std, "lower": middle - k * std})


def compute_emas(close: pd.Series, spans: tuple[int, ...] = DEFAULT_EMA_SPANS) -> pd.DataFrame:
    return pd.DataFrame({str(span): ema(close, span) for span in spans})


# -- overlays ---------------------------------------------------------------------------------


def _sma(df: pd.DataFrame, window: int) -> pd.DataFrame:
    return pd.DataFrame({"sma": sma(df["Close"], window)})


def _ema(df: pd.DataFrame, span: int) -> pd.DataFrame:
    return pd.DataFrame({"ema": ema(df["Close"], span)})


def _bb(df: pd.DataFrame, window: int, k: float) -> pd.DataFrame:
    return bollinger(df["Close"], window, k)


def vwap(df: pd.DataFrame, per_session: bool = True) -> pd.DataFrame:
    """Volume-weighted average price of the typical price. Intraday bars reset each session
    (calendar day of the bar's own timestamp); daily and slower bars accumulate from the first bar
    shown, which is what charting apps do when no session boundary exists."""
    typical = (df["High"] + df["Low"] + df["Close"]) / 3
    volume = df["Volume"].astype(float)
    pv = typical * volume
    if per_session and isinstance(df.index, pd.DatetimeIndex):
        key = df.index.normalize()
        cum_pv = pv.groupby(key).cumsum()
        cum_v = volume.groupby(key).cumsum()
    else:
        cum_pv, cum_v = pv.cumsum(), volume.cumsum()
    out = cum_pv / cum_v.replace(0, np.nan)
    return pd.DataFrame({"vwap": out})


def psar(df: pd.DataFrame, step: float = 0.02, max_step: float = 0.2) -> pd.DataFrame:
    """Parabolic SAR (Wilder). Starts long on bar 1 using bar 0 as the extreme point."""
    high = df["High"].to_numpy(dtype=float)
    low = df["Low"].to_numpy(dtype=float)
    n = len(df)
    out = np.full(n, np.nan)
    if n < 2:
        return pd.DataFrame({"sar": out}, index=df.index)
    rising = True
    sar, ep, af = low[0], high[0], step
    for i in range(1, n):
        prev_sar = sar
        sar = prev_sar + af * (ep - prev_sar)
        if rising:
            sar = min(sar, low[i - 1], low[i - 2] if i >= 2 else low[i - 1])
            if low[i] < sar:  # reversal to falling
                rising, sar, ep, af = False, ep, low[i], step
            else:
                if high[i] > ep:
                    ep, af = high[i], min(af + step, max_step)
        else:
            sar = max(sar, high[i - 1], high[i - 2] if i >= 2 else high[i - 1])
            if high[i] > sar:  # reversal to rising
                rising, sar, ep, af = True, ep, high[i], step
            else:
                if low[i] < ep:
                    ep, af = low[i], min(af + step, max_step)
        out[i] = sar
    return pd.DataFrame({"sar": out}, index=df.index)


def ichimoku(df: pd.DataFrame, tenkan: int = 9, kijun: int = 26, senkou: int = 52) -> pd.DataFrame:
    """Ichimoku lines. The cloud (senkou A/B) is plotted `kijun` bars ahead and the lagging span
    `kijun` bars behind; both shifts are applied within the visible range, so the last `kijun`
    bars have no cloud and the first `kijun` bars have no lagging span."""

    def midline(window: int) -> pd.Series:
        hi = df["High"].rolling(window, min_periods=window).max()
        lo = df["Low"].rolling(window, min_periods=window).min()
        return (hi + lo) / 2

    tenkan_sen = midline(tenkan)
    kijun_sen = midline(kijun)
    senkou_a = ((tenkan_sen + kijun_sen) / 2).shift(kijun)
    senkou_b = midline(senkou).shift(kijun)
    chikou = df["Close"].shift(-kijun)
    return pd.DataFrame(
        {
            "tenkan": tenkan_sen,
            "kijun": kijun_sen,
            "senkou_a": senkou_a,
            "senkou_b": senkou_b,
            "chikou": chikou,
        }
    )


def keltner(
    df: pd.DataFrame, span: int = 20, atr_period: int = 10, mult: float = 2.0
) -> pd.DataFrame:
    middle = ema(df["Close"], span)
    band = mult * wilder(true_range(df), atr_period)
    return pd.DataFrame({"middle": middle, "upper": middle + band, "lower": middle - band})


def donchian(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    upper = df["High"].rolling(window, min_periods=window).max()
    lower = df["Low"].rolling(window, min_periods=window).min()
    return pd.DataFrame({"upper": upper, "middle": (upper + lower) / 2, "lower": lower})


def pivots(df: pd.DataFrame) -> pd.DataFrame:
    """Classic floor-trader pivots from the previous bar's high, low and close."""
    h, lo, c = df["High"].shift(1), df["Low"].shift(1), df["Close"].shift(1)
    pp = (h + lo + c) / 3
    return pd.DataFrame(
        {
            "pp": pp,
            "r1": 2 * pp - lo,
            "s1": 2 * pp - h,
            "r2": pp + (h - lo),
            "s2": pp - (h - lo),
        }
    )


# -- oscillators ------------------------------------------------------------------------------


def rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    delta = df["Close"].diff().iloc[1:]  # bar 0 has no change; seed over bars 1..period
    gain = wilder(delta.clip(lower=0), period).reindex(df.index)
    loss = wilder((-delta).clip(lower=0), period).reindex(df.index)
    rs = gain / loss.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    out = out.where(loss != 0, 100.0).where(gain.notna())
    return pd.DataFrame({"rsi": out})


def macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    if fast >= slow:
        raise IndicatorError("macd: fast span must be shorter than slow span")
    line = ema(df["Close"], fast) - ema(df["Close"], slow)
    sig = line.ewm(span=signal, adjust=False).mean()
    return pd.DataFrame({"macd": line, "signal": sig, "hist": line - sig})


def stochastic(df: pd.DataFrame, k: int = 14, d: int = 3, smooth: int = 3) -> pd.DataFrame:
    """Slow stochastic: raw %K over `k` bars, smoothed by `smooth`, with a `d`-bar %D."""
    lo = df["Low"].rolling(k, min_periods=k).min()
    hi = df["High"].rolling(k, min_periods=k).max()
    raw = 100 * (df["Close"] - lo) / (hi - lo).replace(0, np.nan)
    k_line = raw.rolling(smooth, min_periods=smooth).mean()
    d_line = k_line.rolling(d, min_periods=d).mean()
    return pd.DataFrame({"k": k_line, "d": d_line})


def adx(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    up = df["High"].diff().iloc[1:]
    down = (-df["Low"].diff()).iloc[1:]
    plus_dm = up.where((up > down) & (up > 0), 0.0)
    minus_dm = down.where((down > up) & (down > 0), 0.0)
    atr_ = wilder(true_range(df).iloc[1:], period)
    plus_di = (100 * wilder(plus_dm, period) / atr_.replace(0, np.nan)).reindex(df.index)
    minus_di = (100 * wilder(minus_dm, period) / atr_.replace(0, np.nan)).reindex(df.index)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    # DX is defined from bar `period`; ADX seeds over the next `period` DX values.
    adx_line = wilder(dx.iloc[period:].fillna(0), period).reindex(df.index)
    return pd.DataFrame({"adx": adx_line, "plus_di": plus_di, "minus_di": minus_di})


def atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    return pd.DataFrame({"atr": wilder(true_range(df).fillna(0), period)})


def cci(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    typical = (df["High"] + df["Low"] + df["Close"]) / 3
    mean = typical.rolling(window, min_periods=window).mean()
    dev = typical.rolling(window, min_periods=window).apply(
        lambda x: np.mean(np.abs(x - np.mean(x))), raw=True
    )
    return pd.DataFrame({"cci": (typical - mean) / (0.015 * dev.replace(0, np.nan))})


def obv(df: pd.DataFrame) -> pd.DataFrame:
    direction = np.sign(df["Close"].diff()).fillna(0)
    return pd.DataFrame({"obv": (direction * df["Volume"].astype(float)).cumsum()})


def williams_r(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    hi = df["High"].rolling(period, min_periods=period).max()
    lo = df["Low"].rolling(period, min_periods=period).min()
    return pd.DataFrame({"willr": -100 * (hi - df["Close"]) / (hi - lo).replace(0, np.nan)})


def mfi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    typical = (df["High"] + df["Low"] + df["Close"]) / 3
    flow = typical * df["Volume"].astype(float)
    up = flow.where(typical.diff() > 0, 0.0)
    down = flow.where(typical.diff() < 0, 0.0)
    pos = up.rolling(period, min_periods=period).sum()
    neg = down.rolling(period, min_periods=period).sum()
    out = 100 - 100 / (1 + pos / neg.replace(0, np.nan))
    out = out.where(neg != 0, 100.0).where(pos.notna())
    out.iloc[:period] = np.nan
    return pd.DataFrame({"mfi": out})


def roc(df: pd.DataFrame, period: int = 12) -> pd.DataFrame:
    prev = df["Close"].shift(period)
    return pd.DataFrame({"roc": 100 * (df["Close"] - prev) / prev.replace(0, np.nan)})


# -- registry ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class Param:
    name: str
    default: Number
    min: Number
    max: Number
    integer: bool = True


@dataclass(frozen=True)
class IndicatorSpec:
    id: str
    name: str
    kind: Kind
    outputs: tuple[str, ...]
    description: str
    formula: str
    compute: Callable[..., pd.DataFrame] | None
    params: tuple[Param, ...] = field(default_factory=tuple)
    #: Horizontal reference lines for pane indicators (e.g. RSI 30/70).
    reference_lines: tuple[float, ...] = field(default_factory=tuple)


def _p(name: str, default: Number, lo: Number, hi: Number, *, integer: bool = True) -> Param:
    return Param(name, default, lo, hi, integer)


REGISTRY: dict[str, IndicatorSpec] = {
    s.id: s
    for s in (
        IndicatorSpec(
            "sma",
            "Simple moving average",
            "overlay",
            ("sma",),
            "Average close over the last N bars.",
            "SMA = mean(close, N)",
            _sma,
            (_p("window", 20, 2, 500),),
        ),
        IndicatorSpec(
            "ema",
            "Exponential moving average",
            "overlay",
            ("ema",),
            "Moving average that weights recent closes more, α = 2/(N+1).",
            "EMA_t = α·close_t + (1−α)·EMA_{t−1}",
            _ema,
            (_p("span", 20, 1, 500),),
        ),
        IndicatorSpec(
            "bb",
            "Bollinger Bands",
            "overlay",
            ("middle", "upper", "lower"),
            "SMA with bands k standard deviations above and below.",
            "middle = SMA(N); upper/lower = middle ± k·σ(close, N)",
            _bb,
            (_p("window", 20, 2, 500), _p("k", 2.0, 0.5, 5.0, integer=False)),
        ),
        IndicatorSpec(
            "vwap",
            "VWAP",
            "overlay",
            ("vwap",),
            "Volume-weighted average of the typical price; resets each session on intraday bars, "
            "otherwise accumulates from the first bar shown.",
            "VWAP = Σ(typical·volume) / Σ(volume), typical = (H+L+C)/3",
            vwap,
        ),
        IndicatorSpec(
            "psar",
            "Parabolic SAR",
            "overlay",
            ("sar",),
            "Trailing stop that accelerates toward price while the trend holds and flips on a "
            "break.",
            "SAR_{t+1} = SAR_t + AF·(EP − SAR_t), AF from step up to max",
            psar,
            (_p("step", 0.02, 0.001, 0.2, integer=False), _p("max", 0.2, 0.05, 1.0, integer=False)),
        ),
        IndicatorSpec(
            "ichimoku",
            "Ichimoku Cloud",
            "overlay",
            ("tenkan", "kijun", "senkou_a", "senkou_b", "chikou"),
            "Conversion and base lines, a cloud projected ahead, and a lagging close.",
            "tenkan = mid(9), kijun = mid(26), senkou A = mean(tenkan, kijun) → +26, "
            "senkou B = mid(52) → +26, chikou = close → −26",
            ichimoku,
            (_p("tenkan", 9, 2, 100), _p("kijun", 26, 2, 200), _p("senkou", 52, 2, 400)),
        ),
        IndicatorSpec(
            "keltner",
            "Keltner Channels",
            "overlay",
            ("middle", "upper", "lower"),
            "EMA with bands a multiple of the average true range away.",
            "middle = EMA(N); upper/lower = middle ± m·ATR(P)",
            keltner,
            (
                _p("span", 20, 2, 500),
                _p("atr", 10, 2, 200),
                _p("mult", 2.0, 0.5, 5.0, integer=False),
            ),
        ),
        IndicatorSpec(
            "donchian",
            "Donchian Channels",
            "overlay",
            ("upper", "middle", "lower"),
            "Highest high and lowest low of the last N bars.",
            "upper = max(high, N); lower = min(low, N); middle = mean(upper, lower)",
            donchian,
            (_p("window", 20, 2, 500),),
        ),
        IndicatorSpec(
            "sr",
            "Support / resistance",
            "overlay",
            (),
            "Price levels where local highs and lows cluster, weighted by how often they were "
            "touched.",
            "local extrema (±5 bars) clustered within 1% of price",
            None,
        ),
        IndicatorSpec(
            "pivot",
            "Pivot points",
            "overlay",
            ("pp", "r1", "s1", "r2", "s2"),
            "Classic floor-trader pivot and two support/resistance levels from the previous bar.",
            "PP = (H+L+C)/3; R1 = 2PP − L; S1 = 2PP − H; R2 = PP + (H−L); S2 = PP − (H−L)",
            pivots,
        ),
        IndicatorSpec(
            "rsi",
            "RSI",
            "pane",
            ("rsi",),
            "Relative strength index: momentum on a 0–100 scale; 70+ is often read as "
            "overbought, 30− as oversold.",
            "RSI = 100 − 100 / (1 + avg gain / avg loss), Wilder-smoothed over N",
            rsi,
            (_p("period", 14, 2, 200),),
            reference_lines=(30, 70),
        ),
        IndicatorSpec(
            "macd",
            "MACD",
            "pane",
            ("macd", "signal", "hist"),
            "Difference of two EMAs with a signal line and histogram.",
            "MACD = EMA(fast) − EMA(slow); signal = EMA(MACD, S); hist = MACD − signal",
            macd,
            (_p("fast", 12, 2, 200), _p("slow", 26, 3, 400), _p("signal", 9, 2, 100)),
            reference_lines=(0,),
        ),
        IndicatorSpec(
            "stoch",
            "Stochastic",
            "pane",
            ("k", "d"),
            "Where the close sits in the recent high–low range, smoothed (slow stochastic).",
            "%K = SMA(100·(C − L_N)/(H_N − L_N), smooth); %D = SMA(%K, D)",
            stochastic,
            (_p("k", 14, 2, 200), _p("d", 3, 1, 50), _p("smooth", 3, 1, 50)),
            reference_lines=(20, 80),
        ),
        IndicatorSpec(
            "adx",
            "ADX",
            "pane",
            ("adx", "plus_di", "minus_di"),
            "Trend strength (ADX) with directional lines (+DI, −DI).",
            "±DI = 100·Wilder(±DM)/ATR; DX = 100·|+DI − −DI|/(+DI + −DI); ADX = Wilder(DX)",
            adx,
            (_p("period", 14, 2, 200),),
            reference_lines=(25,),
        ),
        IndicatorSpec(
            "atr",
            "ATR",
            "pane",
            ("atr",),
            "Average true range: typical bar-to-bar movement in price units.",
            "TR = max(H−L, |H−C_prev|, |L−C_prev|); ATR = Wilder(TR, N)",
            atr,
            (_p("period", 14, 2, 200),),
        ),
        IndicatorSpec(
            "cci",
            "CCI",
            "pane",
            ("cci",),
            "Commodity channel index: distance of the typical price from its average, scaled.",
            "CCI = (typical − SMA(typical, N)) / (0.015 · mean deviation)",
            cci,
            (_p("window", 20, 2, 200),),
            reference_lines=(-100, 100),
        ),
        IndicatorSpec(
            "obv",
            "On-balance volume",
            "pane",
            ("obv",),
            "Running total of volume, added on up closes and subtracted on down closes.",
            "OBV_t = OBV_{t−1} ± volume_t by sign(close_t − close_{t−1})",
            obv,
        ),
        IndicatorSpec(
            "willr",
            "Williams %R",
            "pane",
            ("willr",),
            "Where the close sits in the recent range, on a −100–0 scale.",
            "%R = −100 · (H_N − C) / (H_N − L_N)",
            williams_r,
            (_p("period", 14, 2, 200),),
            reference_lines=(-80, -20),
        ),
        IndicatorSpec(
            "mfi",
            "Money flow index",
            "pane",
            ("mfi",),
            "Volume-weighted RSI on a 0–100 scale.",
            "MFI = 100 − 100 / (1 + Σ positive flow / Σ negative flow), flow = typical·volume",
            mfi,
            (_p("period", 14, 2, 200),),
            reference_lines=(20, 80),
        ),
        IndicatorSpec(
            "roc",
            "Rate of change",
            "pane",
            ("roc",),
            "Percent change of the close over N bars.",
            "ROC = 100 · (C − C_{t−N}) / C_{t−N}",
            roc,
            (_p("period", 12, 1, 500),),
            reference_lines=(0,),
        ),
    )
}


@dataclass(frozen=True)
class IndicatorRequest:
    spec: IndicatorSpec
    params: dict[str, Number]

    @property
    def token(self) -> str:
        """Canonical token: id plus every parameter in spec order, so `rsi` and `rsi:14` agree."""
        if not self.spec.params:
            return self.spec.id
        return f"{self.spec.id}:" + "-".join(_fmt(self.params[p.name]) for p in self.spec.params)


def _fmt(value: Number) -> str:
    return str(int(value)) if float(value).is_integer() else repr(float(value))


def parse_token(token: str) -> IndicatorRequest:
    token = token.strip()
    ident, _, raw = token.partition(":")
    spec = REGISTRY.get(ident.lower())
    if spec is None:
        raise IndicatorError(f"Unknown indicator: {ident!r}")
    values = [v for v in raw.split("-") if v != ""] if raw else []
    if len(values) > len(spec.params):
        raise IndicatorError(f"{spec.id}: takes at most {len(spec.params)} parameter(s)")
    params: dict[str, Number] = {}
    for i, p in enumerate(spec.params):
        if i < len(values):
            try:
                number: Number = int(values[i]) if p.integer else float(values[i])
            except ValueError as exc:
                raise IndicatorError(f"{spec.id}: {p.name} must be a number") from exc
            if not (p.min <= number <= p.max):
                raise IndicatorError(f"{spec.id}: {p.name} must be between {p.min} and {p.max}")
            params[p.name] = number
        else:
            params[p.name] = p.default
    if spec.id == "macd" and params["fast"] >= params["slow"]:
        raise IndicatorError("macd: fast span must be shorter than slow span")
    return IndicatorRequest(spec, params)


def parse_tokens(raw: str | None) -> list[IndicatorRequest]:
    """Parse a comma-separated `ind` query; empty/None = the defaults. Duplicates collapse."""
    tokens = [t for t in (raw or "").split(",") if t.strip()] or list(DEFAULT_TOKENS)
    seen: dict[str, IndicatorRequest] = {}
    for t in tokens:
        req = parse_token(t)
        seen.setdefault(req.token, req)
    if len(seen) > MAX_INDICATORS_PER_REQUEST:
        raise IndicatorError(f"At most {MAX_INDICATORS_PER_REQUEST} indicators per request")
    return list(seen.values())


def compute(req: IndicatorRequest, df: pd.DataFrame) -> pd.DataFrame:
    """Run one indicator; the result has exactly the spec's output columns (empty for `sr`)."""
    if req.spec.compute is None:
        return pd.DataFrame(index=df.index)
    if req.spec.id == "psar":
        out = req.spec.compute(df, step=req.params["step"], max_step=req.params["max"])
    elif req.spec.id == "keltner":
        out = req.spec.compute(
            df, span=req.params["span"], atr_period=req.params["atr"], mult=req.params["mult"]
        )
    else:
        out = req.spec.compute(df, **req.params)
    return out[list(req.spec.outputs)]


def catalog() -> list[dict]:
    """JSON-ready view of the registry for `/indicators/catalog` and the FAQ."""
    return [
        {
            "id": s.id,
            "name": s.name,
            "kind": s.kind,
            "outputs": list(s.outputs),
            "params": [
                {
                    "name": p.name,
                    "default": p.default,
                    "min": p.min,
                    "max": p.max,
                    "integer": p.integer,
                }
                for p in s.params
            ],
            "reference_lines": list(s.reference_lines),
            "description": s.description,
            "formula": s.formula,
        }
        for s in REGISTRY.values()
    ]
