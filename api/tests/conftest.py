import pytest
from fastapi.testclient import TestClient

from app.deps import get_market_data
from app.main import create_app
from app.services.cache import Cache
from app.services.market_data import MarketData
from app.settings import Settings
from tests.fakes import FakeYF, make_ohlc


@pytest.fixture
def fake_yf() -> FakeYF:
    return FakeYF()


@pytest.fixture
def market_data(fake_yf: FakeYF) -> MarketData:
    return MarketData(cache=Cache(), settings=Settings(), yfinance_module=fake_yf)


@pytest.fixture
def client(market_data: MarketData) -> TestClient:
    """TestClient whose routers talk to the fake yfinance module, never the network."""
    app = create_app()
    app.dependency_overrides[get_market_data] = lambda: market_data
    return TestClient(app)


@pytest.fixture
def ohlc():
    return make_ohlc(30)
