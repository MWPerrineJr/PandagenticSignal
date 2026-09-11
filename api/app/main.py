from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.errors import (
    InsufficientHistoryError,
    RateLimitedError,
    SentimentDisabledError,
    TickerNotFoundError,
    UpstreamError,
)
from app.logging_config import access_log_middleware, configure_logging
from app.ratelimit import RateLimiter
from app.routers import (
    crypto,
    history,
    portfolio,
    quotes,
    recommendations,
    retirement,
    search,
    sentiment,
)
from app.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)
    app = FastAPI(title="Stock Analysis API", version="0.2.0")

    limiter = RateLimiter(
        settings.rate_limit,
        overrides={
            "/portfolio/simulate": settings.simulate_rate_limit,
            "/retirement": settings.simulate_rate_limit,
            "/sentiment": settings.sentiment_rate_limit,
        },
        enabled=settings.rate_limit_enabled,
    )
    app.state.limiter = limiter

    # Order matters: Starlette wraps in reverse, so CORS is outermost, then logging, then limits.
    app.middleware("http")(limiter.middleware)
    app.middleware("http")(access_log_middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        max_age=600,
    )

    @app.exception_handler(TickerNotFoundError)
    def _not_found(_: Request, exc: TickerNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(RateLimitedError)
    def _rate_limited(_: Request, exc: RateLimitedError) -> JSONResponse:
        return JSONResponse(
            status_code=503, content={"detail": str(exc)}, headers={"Retry-After": "30"}
        )

    @app.exception_handler(SentimentDisabledError)
    def _sentiment_disabled(_: Request, exc: SentimentDisabledError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.exception_handler(InsufficientHistoryError)
    def _insufficient(_: Request, exc: InsufficientHistoryError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(UpstreamError)
    def _upstream(_: Request, exc: UpstreamError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    routers = (
        search.router,
        quotes.router,
        history.router,
        recommendations.router,
        crypto.router,
        portfolio.router,
        retirement.router,
        sentiment.router,
    )
    for r in routers:
        app.include_router(r)

    return app


app = create_app()
