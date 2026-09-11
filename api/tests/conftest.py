import pytest
from fastapi.testclient import TestClient

from app.deps import get_market_data, get_sentiment_agent
from app.main import create_app
from app.services.cache import Cache
from app.services.crypto import CryptoData
from app.services.market_data import MarketData
from app.services.sentiment import SentimentAgent
from app.settings import Settings
from tests.fake_anthropic import FakeAnthropic
from tests.fakes import FAKE_NOW, FakeFetch, FakeYF, make_ohlc


@pytest.fixture
def fake_yf() -> FakeYF:
    return FakeYF()


@pytest.fixture
def fake_fetch() -> FakeFetch:
    return FakeFetch()


@pytest.fixture
def crypto(fake_fetch: FakeFetch) -> CryptoData:
    return CryptoData(
        cache=Cache(), settings=Settings(), fetch_json=fake_fetch, now=lambda: FAKE_NOW
    )


@pytest.fixture
def market_data(fake_yf: FakeYF, crypto: CryptoData) -> MarketData:
    return MarketData(cache=Cache(), settings=Settings(), yfinance_module=fake_yf, crypto=crypto)


@pytest.fixture
def fake_anthropic() -> FakeAnthropic:
    return FakeAnthropic()


@pytest.fixture
def sentiment_agent(fake_anthropic: FakeAnthropic) -> SentimentAgent:
    return SentimentAgent(
        fake_anthropic, model="claude-test", cache=Cache(), ttl=3600, now=lambda: FAKE_NOW
    )


@pytest.fixture
def client(market_data: MarketData, sentiment_agent: SentimentAgent) -> TestClient:
    """TestClient whose routers talk to the fake yfinance module, never the network."""
    app = create_app()
    app.dependency_overrides[get_market_data] = lambda: market_data
    app.dependency_overrides[get_sentiment_agent] = lambda: sentiment_agent
    return TestClient(app)


@pytest.fixture
def ohlc():
    return make_ohlc(30)
