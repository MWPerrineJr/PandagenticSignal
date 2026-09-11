from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.services.market_data import MarketData
from app.services.sentiment import SentimentAgent, make_agent
from app.settings import get_settings


@lru_cache
def get_market_data() -> MarketData:
    return MarketData()


@lru_cache
def get_sentiment_agent() -> SentimentAgent:
    return make_agent(get_settings())


MarketDataDep = Annotated[MarketData, Depends(get_market_data)]
SentimentAgentDep = Annotated[SentimentAgent, Depends(get_sentiment_agent)]
