from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.services.market_data import MarketData


@lru_cache
def get_market_data() -> MarketData:
    return MarketData()


MarketDataDep = Annotated[MarketData, Depends(get_market_data)]
