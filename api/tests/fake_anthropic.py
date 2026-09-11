"""Stand-in for `anthropic.Anthropic` covering exactly what `SentimentAgent` uses:
`client.messages.parse(**kwargs)` returning an object with `parsed_output` and `stop_reason`."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import anthropic
import httpx2

from app.schemas import ArticleSentiment, SentimentReport


def make_report(n_articles: int = 3, **overrides: Any) -> SentimentReport:
    base = dict(
        overall="bullish",
        score=0.6,
        confidence=0.7,
        themes=["Record iPhone demand", "Services growth", "Regulatory scrutiny"],
        articles=[
            ArticleSentiment(
                index=i,
                sentiment="bullish" if i % 2 else "neutral",
                rationale=f"Article {i} rationale.",
            )
            for i in range(1, n_articles + 1)
        ],
        summary="Coverage is broadly positive with one regulatory caveat.",
    )
    base.update(overrides)
    return SentimentReport(**base)


@dataclass
class FakeResponse:
    parsed_output: SentimentReport | None
    stop_reason: str = "end_turn"


def _http_response(status: int) -> httpx2.Response:
    return httpx2.Response(status, request=httpx2.Request("POST", "https://api.anthropic.test"))


def rate_limit_error() -> anthropic.RateLimitError:
    return anthropic.RateLimitError("rate limited", response=_http_response(429), body=None)


def status_error(status: int = 500) -> anthropic.APIStatusError:
    return anthropic.APIStatusError("boom", response=_http_response(status), body=None)


def connection_error() -> anthropic.APIConnectionError:
    return anthropic.APIConnectionError(
        request=httpx2.Request("POST", "https://api.anthropic.test")
    )


@dataclass
class FakeMessages:
    calls: list[dict[str, Any]] = field(default_factory=list)
    error: Exception | None = None
    response: FakeResponse | None = None

    def parse(self, **kwargs: Any) -> FakeResponse:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.response or FakeResponse(parsed_output=make_report())


class FakeAnthropic:
    def __init__(self) -> None:
        self.messages = FakeMessages()

    @property
    def calls(self) -> list[dict[str, Any]]:
        return self.messages.calls
