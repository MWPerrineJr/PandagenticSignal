"""AI news-sentiment agent: one Claude call per symbol per hour over Yahoo headlines.

The agent owns its own `Cache` so a slow model call never contends with the market-data
cache lock, and concurrent requests for one symbol collapse into a single paid call.
Everything the model says is a summary of news *tone*; the prompt forbids advice and the
response carries a fixed disclaimer.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import anthropic

from app.errors import RateLimitedError, UpstreamError
from app.schemas import (
    NewsItem,
    SentimentArticleOut,
    SentimentOut,
    SentimentReport,
)
from app.services.cache import Cache
from app.settings import Settings

DISCLAIMER = "Automated summary of news tone, not investment advice."
MAX_ARTICLES = 12
MAX_SUMMARY_CHARS = 600
MAX_THEMES = 5

# Frozen: it is the cached prefix. Anything that changes per request goes in the user turn.
SYSTEM_PROMPT = """You are a financial news analyst working inside a personal stock-research tool.

You will be given a ticker symbol and a numbered list of recent news headlines with short \
summaries. Your job is to describe the *tone* of that coverage, nothing more.

Rules:
- Judge only what the articles say. Do not use outside knowledge of the company or the \
market, and do not speculate about where the price is going.
- Never give investment advice, price targets or predictions, and never tell the reader \
what to do. Describe the coverage; the reader decides.
- When coverage is thin, mixed, or not really about the company, say so and lean neutral \
with low confidence rather than inventing a signal.
- Classify each article as bullish, neutral or bearish *for this specific ticker*, with a \
one-sentence rationale grounded in that article.
- `score` is the overall tone from -1 (uniformly negative) to +1 (uniformly positive); \
`confidence` is 0 to 1 and should fall when articles disagree or are few.
- List 3 to 5 short recurring themes (two to five words each).
- `summary` is two or three plain sentences, no bullet points, no hedging boilerplate.
- Cover every article index you were given exactly once."""


def build_user_message(symbol: str, news: list[NewsItem]) -> str:
    lines = [f"Ticker: {symbol}", f"Articles ({len(news)}):", ""]
    for i, item in enumerate(news, start=1):
        meta = " · ".join(x for x in (item.provider, item.published_at) if x)
        lines.append(f"{i}. {item.title}")
        if meta:
            lines.append(f"   ({meta})")
        summary = item.summary.strip()
        if summary:
            if len(summary) > MAX_SUMMARY_CHARS:
                summary = summary[: MAX_SUMMARY_CHARS - 1].rstrip() + "…"
            lines.append(f"   {summary}")
        lines.append("")
    lines.append("Analyse the tone of this coverage for the ticker above.")
    return "\n".join(lines)


def clamp_report(report: SentimentReport, n_articles: int) -> SentimentReport:
    """Enforce the bounds the prompt asks for; the schema itself is deliberately loose."""
    seen: set[int] = set()
    articles = []
    for a in report.articles:
        if 1 <= a.index <= n_articles and a.index not in seen:
            seen.add(a.index)
            articles.append(a)
    articles.sort(key=lambda a: a.index)
    return report.model_copy(
        update={
            "score": max(-1.0, min(1.0, float(report.score))),
            "confidence": max(0.0, min(1.0, float(report.confidence))),
            "themes": [t.strip() for t in report.themes if t.strip()][:MAX_THEMES],
            "articles": articles,
            "summary": report.summary.strip(),
        }
    )


class SentimentAgent:
    def __init__(
        self,
        client: Any | None,
        *,
        model: str,
        max_tokens: int = 8192,
        effort: str = "medium",
        cache: Cache | None = None,
        ttl: float = 3600,
        now: Callable[[], float] = time.time,
    ) -> None:
        self.client = client
        self.model = model
        self.max_tokens = max_tokens
        self.effort = effort
        self.cache = cache or Cache(maxsize=256)
        self.ttl = ttl
        self.now = now

    @property
    def enabled(self) -> bool:
        return self.client is not None

    # -- model call -------------------------------------------------------------------------

    def analyse(self, symbol: str, news: list[NewsItem]) -> SentimentReport:
        """One structured-output call. Raises `UpstreamError` / `RateLimitedError` only."""
        if self.client is None:
            raise UpstreamError("Sentiment analysis is not configured")
        news = news[:MAX_ARTICLES]
        try:
            response = self.client.messages.parse(
                model=self.model,
                max_tokens=self.max_tokens,
                output_config={"effort": self.effort},
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": build_user_message(symbol, news)}],
                output_format=SentimentReport,
            )
        except anthropic.RateLimitError as exc:
            raise RateLimitedError("The sentiment model is rate-limited; retry shortly") from exc
        except anthropic.APIStatusError as exc:
            raise UpstreamError(f"Sentiment model error ({exc.status_code})") from exc
        except anthropic.APIConnectionError as exc:
            raise UpstreamError("Could not reach the sentiment model") from exc

        if response.stop_reason == "refusal":
            raise UpstreamError("The sentiment model declined to analyse this coverage")
        parsed = response.parsed_output
        if parsed is None:
            raise UpstreamError(
                f"The sentiment model returned no report (stop reason: {response.stop_reason})"
            )
        return clamp_report(parsed, len(news))

    # -- cached report ----------------------------------------------------------------------

    def report(self, symbol: str, news: list[NewsItem]) -> SentimentOut:
        news = news[:MAX_ARTICLES]
        fresh = False

        def build() -> SentimentOut:
            nonlocal fresh
            fresh = True
            report = self.analyse(symbol, news) if news else None
            return self._assemble(symbol, news, report)

        out = self.cache.get_or_set("sentiment", symbol, self.ttl, build)
        return out.model_copy(update={"cached": not fresh})

    def _assemble(
        self, symbol: str, news: list[NewsItem], report: SentimentReport | None
    ) -> SentimentOut:
        by_index = {a.index: a for a in report.articles} if report else {}
        articles = [
            SentimentArticleOut(
                index=i,
                title=item.title,
                provider=item.provider,
                published_at=item.published_at,
                url=item.url,
                sentiment=by_index[i].sentiment if i in by_index else None,
                rationale=by_index[i].rationale if i in by_index else None,
            )
            for i, item in enumerate(news, start=1)
        ]
        return SentimentOut(
            symbol=symbol,
            generated_at=int(self.now()),
            model=self.model,
            cached=False,
            news_count=len(news),
            report=report,
            articles=articles,
            disclaimer=DISCLAIMER,
        )


def make_agent(settings: Settings) -> SentimentAgent:
    """Production factory: a real client when a key is configured, otherwise a disabled agent."""
    client = (
        anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=90.0, max_retries=1)
        if settings.anthropic_api_key
        else None
    )
    return SentimentAgent(
        client,
        model=settings.sentiment_model,
        max_tokens=settings.sentiment_max_tokens,
        effort=settings.sentiment_effort,
        ttl=settings.sentiment_ttl,
    )
