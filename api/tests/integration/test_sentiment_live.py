"""One paid Claude call. Excluded by default; needs `pytest -m integration` and an API key
(`STOCK_API_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY`)."""

import os

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

pytestmark = pytest.mark.integration

HAS_KEY = bool(os.environ.get("STOCK_API_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))


@pytest.mark.skipif(not HAS_KEY, reason="no Anthropic API key in the environment")
def test_sentiment_live() -> None:
    live = TestClient(create_app())
    assert live.get("/sentiment/status").json()["enabled"] is True
    r = live.get("/sentiment/AAPL")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["news_count"] > 0
    report = body["report"]
    assert report["overall"] in {"bullish", "neutral", "bearish"}
    assert -1 <= report["score"] <= 1 and 0 <= report["confidence"] <= 1
    assert 1 <= len(report["themes"]) <= 5
    assert len(report["articles"]) == body["news_count"]
    assert live.get("/sentiment/AAPL").json()["cached"] is True
