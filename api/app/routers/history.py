import math

import pandas as pd
from fastapi import APIRouter

from app.deps import MarketDataDep
from app.schemas import BollingerSeries, History, Indicators, Interval, LevelOut, Period
from app.services.indicators import DEFAULT_EMA_SPANS, bollinger, compute_emas
from app.services.levels import support_resistance
from app.services.market_data import frame_to_candles

router = APIRouter(tags=["history"])

BOLLINGER_WINDOW = 20
BOLLINGER_K = 2.0


def _clean(series: pd.Series) -> list[float | None]:
    return [None if (v is None or math.isnan(v)) else float(v) for v in series.tolist()]


@router.get("/history/{ticker}", response_model=History)
def history(
    ticker: str,
    md: MarketDataDep,
    period: Period = "1y",
    interval: Interval = "1d",
) -> History:
    df = md.history(ticker, period=period, interval=interval)
    return History(
        symbol=ticker.strip().upper(),
        period=period,
        interval=interval,
        candles=frame_to_candles(df),
    )


@router.get("/indicators/{ticker}", response_model=Indicators)
def indicators(
    ticker: str,
    md: MarketDataDep,
    period: Period = "1y",
    interval: Interval = "1d",
) -> Indicators:
    df = md.history(ticker, period=period, interval=interval)
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    close = df["Close"]
    emas = compute_emas(close, DEFAULT_EMA_SPANS)
    bands = bollinger(close, window=BOLLINGER_WINDOW, k=BOLLINGER_K)
    levels = support_resistance(df)
    return Indicators(
        symbol=ticker.strip().upper(),
        period=period,
        interval=interval,
        candles=frame_to_candles(df),
        ema={span: _clean(emas[span]) for span in emas.columns},
        bollinger=BollingerSeries(
            window=BOLLINGER_WINDOW,
            k=BOLLINGER_K,
            middle=_clean(bands["middle"]),
            upper=_clean(bands["upper"]),
            lower=_clean(bands["lower"]),
        ),
        levels=[LevelOut(price=lv.price, touches=lv.touches, kind=lv.kind) for lv in levels],
    )
