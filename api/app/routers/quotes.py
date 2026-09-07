from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import MarketDataDep
from app.schemas import Quote, QuoteBatch

router = APIRouter(tags=["quotes"])

TICKER_PATH = {"min_length": 1, "max_length": 16, "pattern": r"^[A-Za-z0-9.\-^=]+$"}


@router.get("/quote/{ticker}", response_model=Quote)
def quote(ticker: str, md: MarketDataDep) -> Quote:
    return md.quote(ticker)


@router.get("/quotes", response_model=QuoteBatch)
def quotes(
    tickers: Annotated[str, Query(min_length=1, description="Comma-separated symbols")],
    md: MarketDataDep,
) -> QuoteBatch:
    symbols = [s for s in tickers.split(",") if s.strip()][:50]
    found, missing = md.quotes(symbols)
    return QuoteBatch(quotes=found, missing=missing)
