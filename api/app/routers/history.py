import math

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.deps import MarketDataDep
from app.schemas import (
    History,
    IndicatorCatalog,
    Indicators,
    IndicatorSeriesOut,
    Interval,
    LevelOut,
    Period,
)
from app.services import indicators as ind
from app.services.levels import fib_retracement, support_resistance
from app.services.market_data import frame_to_candles

router = APIRouter(tags=["history"])


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


@router.get("/indicators/catalog", response_model=IndicatorCatalog)
def indicator_catalog() -> IndicatorCatalog:
    """Every indicator the API can compute, with parameter ranges and defaults."""
    return IndicatorCatalog(
        indicators=ind.catalog(),
        defaults=list(ind.DEFAULT_TOKENS),
        max_per_request=ind.MAX_INDICATORS_PER_REQUEST,
    )


@router.get("/indicators/{ticker}", response_model=Indicators)
def indicators(
    ticker: str,
    md: MarketDataDep,
    period: Period = "1y",
    interval: Interval = "1d",
    ind_: str | None = Query(
        default=None,
        alias="ind",
        description="Comma-separated tokens: `rsi`, `rsi:14`, `macd:12-26-9`, `sr`. "
        "Omit for the default overlays.",
    ),
) -> Indicators:
    try:
        requests = ind.parse_tokens(ind_)
    except ind.IndicatorError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    df = md.history(ticker, period=period, interval=interval)
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    series: dict[str, IndicatorSeriesOut] = {}
    levels: list[LevelOut] = []
    for req in requests:
        if req.spec.id == "sr":
            levels.extend(
                LevelOut(price=lv.price, touches=lv.touches, kind=lv.kind, label=lv.label)
                for lv in support_resistance(df)
            )
        elif req.spec.id == "fib":
            levels.extend(
                LevelOut(price=lv.price, touches=lv.touches, kind=lv.kind, label=lv.label)
                for lv in fib_retracement(df)
            )
        try:
            frame = ind.compute(req, df)
        except ind.IndicatorError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        series[req.token] = IndicatorSeriesOut(
            id=req.spec.id,
            kind=req.spec.kind,
            params={k: float(v) for k, v in req.params.items()},
            outputs={name: _clean(frame[name]) for name in req.spec.outputs},
        )
    return Indicators(
        symbol=ticker.strip().upper(),
        period=period,
        interval=interval,
        candles=frame_to_candles(df),
        series=series,
        levels=levels,
    )
