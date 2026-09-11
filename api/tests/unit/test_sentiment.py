import pytest
from fastapi.testclient import TestClient

from app.errors import RateLimitedError, UpstreamError
from app.schemas import NewsItem
from app.services.cache import Cache
from app.services.market_data import MarketData
from app.services.sentiment import (
    DISCLAIMER,
    MAX_ARTICLES,
    SYSTEM_PROMPT,
    SentimentAgent,
    build_user_message,
    clamp_report,
    make_agent,
)
from app.settings import Settings
from tests.fake_anthropic import (
    FakeAnthropic,
    FakeResponse,
    connection_error,
    make_report,
    rate_limit_error,
    status_error,
)
from tests.fakes import FAKE_NOW, FakeYF

# -- news (MarketData) ---------------------------------------------------------------------


def test_news_reduces_yahoo_entries(market_data: MarketData) -> None:
    items = market_data.news("aapl")
    assert [i.title for i in items] == [
        "Apple beats on iPhone demand",
        "EU opens new probe into App Store fees",
        "Services revenue hits record",
    ]
    assert items[0].provider == "Reuters"
    assert items[0].url == "https://example.com/apple-beats"
    assert items[0].published_at == "2026-09-10T12:00:00Z"
    assert items[1].url == "https://example.com/eu-probe"  # clickThroughUrl fallback
    assert items[1].summary == ""
    assert items[2].provider is None and items[2].url is None


def test_news_is_cached(market_data: MarketData, fake_yf: FakeYF) -> None:
    market_data.news("AAPL")
    fake_yf.fail_with_upstream()
    assert len(market_data.news("AAPL")) == 3


def test_news_empty_for_real_symbol_and_404_for_unknown(market_data: MarketData) -> None:
    assert market_data.news("MSFT") == []
    from app.errors import TickerNotFoundError

    with pytest.raises(TickerNotFoundError):
        market_data.news("ZZZZ")


def test_news_absent_attribute_is_empty(market_data: MarketData) -> None:
    # BTC-USD exists in FAST_INFO but FakeTicker.news raises AttributeError → treated as none.
    assert market_data.news("BTC-USD") == []


# -- prompt + clamping ---------------------------------------------------------------------


def test_user_message_lists_every_article_and_truncates_summaries(
    market_data: MarketData,
) -> None:
    news = market_data.news("AAPL")
    msg = build_user_message("AAPL", news)
    assert msg.startswith("Ticker: AAPL\nArticles (3):")
    for i, item in enumerate(news, start=1):
        assert f"{i}. {item.title}" in msg
    assert "(Reuters · 2026-09-10T12:00:00Z)" in msg
    assert "S" * 600 not in msg and "S" * 500 + "…" in msg


def test_clamp_report_bounds_and_dedupes_articles() -> None:
    report = make_report(
        3,
        score=7.0,
        confidence=-2.0,
        themes=[" a ", "", "b", "c", "d", "e", "f"],
        articles=[
            *make_report(3).articles,
            *make_report(1).articles,  # duplicate index 1
            make_report(1).articles[0].model_copy(update={"index": 9}),  # out of range
        ],
        summary="  spaced  ",
    )
    out = clamp_report(report, 3)
    assert out.score == 1.0 and out.confidence == 0.0
    assert out.themes == ["a", "b", "c", "d", "e"]
    assert [a.index for a in out.articles] == [1, 2, 3]
    assert out.summary == "spaced"


# -- agent -----------------------------------------------------------------------------------


def test_disabled_agent() -> None:
    agent = make_agent(Settings(anthropic_api_key=""))
    assert agent.enabled is False
    with pytest.raises(UpstreamError):
        agent.analyse("AAPL", [NewsItem(title="x")])


def test_make_agent_with_key_builds_real_client() -> None:
    agent = make_agent(Settings(anthropic_api_key="sk-test", sentiment_model="claude-x"))
    assert agent.enabled is True and agent.model == "claude-x"


def test_analyse_sends_cached_system_prompt_and_all_titles(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic, market_data: MarketData
) -> None:
    news = market_data.news("AAPL")
    report = sentiment_agent.analyse("AAPL", news)
    assert report.overall == "bullish"
    (call,) = fake_anthropic.calls
    assert call["model"] == "claude-test"
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert call["system"][0]["text"] == SYSTEM_PROMPT
    assert call["output_format"].__name__ == "SentimentReport"
    user = call["messages"][0]["content"]
    for item in news:
        assert item.title in user


def test_analyse_caps_articles(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic
) -> None:
    news = [NewsItem(title=f"t{i}") for i in range(MAX_ARTICLES + 5)]
    sentiment_agent.analyse("AAPL", news)
    assert f"Articles ({MAX_ARTICLES}):" in fake_anthropic.calls[0]["messages"][0]["content"]


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (rate_limit_error(), RateLimitedError),
        (status_error(500), UpstreamError),
        (status_error(400), UpstreamError),
        (connection_error(), UpstreamError),
    ],
)
def test_analyse_maps_sdk_errors(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic, error, expected
) -> None:
    fake_anthropic.messages.error = error
    with pytest.raises(expected):
        sentiment_agent.analyse("AAPL", [NewsItem(title="x")])


def test_analyse_refusal_and_missing_output_are_upstream_errors(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic
) -> None:
    fake_anthropic.messages.response = FakeResponse(parsed_output=None, stop_reason="refusal")
    with pytest.raises(UpstreamError, match="declined"):
        sentiment_agent.analyse("AAPL", [NewsItem(title="x")])
    fake_anthropic.messages.response = FakeResponse(parsed_output=None, stop_reason="max_tokens")
    with pytest.raises(UpstreamError, match="max_tokens"):
        sentiment_agent.analyse("AAPL", [NewsItem(title="x")])


def test_report_is_cached_per_symbol_and_flags_cached(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic, market_data: MarketData
) -> None:
    news = market_data.news("AAPL")
    first = sentiment_agent.report("AAPL", news)
    second = sentiment_agent.report("AAPL", news)
    assert first.cached is False and second.cached is True
    assert len(fake_anthropic.calls) == 1
    assert first.generated_at == FAKE_NOW
    assert first.report is not None and first.report.overall == "bullish"
    assert [a.sentiment for a in first.articles] == ["bullish", "neutral", "bullish"]
    assert first.articles[0].rationale == "Article 1 rationale."
    assert first.articles[0].url == "https://example.com/apple-beats"
    assert first.disclaimer == DISCLAIMER


def test_report_without_news_skips_the_model(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic
) -> None:
    out = sentiment_agent.report("MSFT", [])
    assert out.report is None and out.news_count == 0 and out.articles == []
    assert fake_anthropic.calls == []


def test_report_failure_is_not_cached(
    sentiment_agent: SentimentAgent, fake_anthropic: FakeAnthropic
) -> None:
    fake_anthropic.messages.error = status_error(500)
    with pytest.raises(UpstreamError):
        sentiment_agent.report("AAPL", [NewsItem(title="x")])
    fake_anthropic.messages.error = None
    assert sentiment_agent.report("AAPL", [NewsItem(title="x")]).cached is False
    assert len(fake_anthropic.calls) == 2


def test_report_cache_expires(fake_anthropic: FakeAnthropic) -> None:
    clock = [0.0]
    cache = Cache(timer=lambda: clock[0])
    agent = SentimentAgent(fake_anthropic, model="m", cache=cache, ttl=10, now=lambda: clock[0])
    agent.report("AAPL", [NewsItem(title="x")])
    clock[0] = 11
    assert agent.report("AAPL", [NewsItem(title="x")]).cached is False
    assert len(fake_anthropic.calls) == 2


# -- routes ----------------------------------------------------------------------------------


def test_status_route(client: TestClient) -> None:
    assert client.get("/sentiment/status").json() == {"enabled": True, "model": "claude-test"}


def test_sentiment_route_happy_path(client: TestClient) -> None:
    r = client.get("/sentiment/aapl")
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL" and body["cached"] is False and body["news_count"] == 3
    assert body["report"]["overall"] == "bullish"
    assert body["articles"][1]["sentiment"] == "neutral"
    assert client.get("/sentiment/AAPL").json()["cached"] is True


def test_sentiment_route_no_news(client: TestClient) -> None:
    body = client.get("/sentiment/MSFT").json()
    assert body["report"] is None and body["articles"] == []


def test_sentiment_route_unknown_symbol(client: TestClient) -> None:
    assert client.get("/sentiment/ZZZZ").status_code == 404


def test_sentiment_route_errors(client: TestClient, fake_anthropic: FakeAnthropic) -> None:
    fake_anthropic.messages.error = rate_limit_error()
    r = client.get("/sentiment/AAPL")
    assert r.status_code == 503 and r.headers["retry-after"] == "30"
    fake_anthropic.messages.error = status_error(502)
    assert client.get("/sentiment/AAPL").status_code == 502


def test_sentiment_route_disabled(market_data: MarketData) -> None:
    from app.deps import get_market_data, get_sentiment_agent
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_market_data] = lambda: market_data
    app.dependency_overrides[get_sentiment_agent] = lambda: SentimentAgent(None, model="m")
    c = TestClient(app)
    assert c.get("/sentiment/status").json() == {"enabled": False, "model": None}
    r = c.get("/sentiment/AAPL")
    assert r.status_code == 503 and r.json()["detail"] == "Sentiment analysis is not configured"


def test_default_dependency_is_disabled_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import deps
    from app.settings import get_settings

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("STOCK_API_ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    deps.get_sentiment_agent.cache_clear()
    try:
        assert deps.get_sentiment_agent().enabled is False
    finally:
        get_settings.cache_clear()
        deps.get_sentiment_agent.cache_clear()
