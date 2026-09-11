from fastapi import APIRouter

from app.deps import MarketDataDep, SentimentAgentDep
from app.errors import SentimentDisabledError
from app.schemas import SentimentOut, SentimentStatus
from app.services.market_data import normalise_ticker

router = APIRouter(prefix="/sentiment", tags=["sentiment"])


@router.get("/status", response_model=SentimentStatus)
def status(agent: SentimentAgentDep) -> SentimentStatus:
    return SentimentStatus(enabled=agent.enabled, model=agent.model if agent.enabled else None)


@router.get("/{ticker}", response_model=SentimentOut)
def sentiment(ticker: str, md: MarketDataDep, agent: SentimentAgentDep) -> SentimentOut:
    if not agent.enabled:
        raise SentimentDisabledError()
    symbol = normalise_ticker(ticker)
    news = md.news(symbol)
    return agent.report(symbol, news)
