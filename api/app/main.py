from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.errors import RateLimitedError, TickerNotFoundError, UpstreamError
from app.logging_config import access_log_middleware, client_ip, configure_logging
from app.routers import history, quotes, recommendations, search
from app.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)
    app = FastAPI(title="Stock Analysis API", version="0.2.0")

    limiter = Limiter(
        key_func=client_ip,
        default_limits=[settings.rate_limit],
        enabled=settings.rate_limit_enabled,
        headers_enabled=True,
    )
    app.state.limiter = limiter

    app.add_middleware(SlowAPIMiddleware)
    app.middleware("http")(access_log_middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET"],
        allow_headers=["*"],
        max_age=600,
    )

    @app.exception_handler(RateLimitExceeded)
    def _too_many(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded: {exc.detail}"},
            headers={"Retry-After": "60"},
        )

    @app.exception_handler(TickerNotFoundError)
    def _not_found(_: Request, exc: TickerNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(RateLimitedError)
    def _rate_limited(_: Request, exc: RateLimitedError) -> JSONResponse:
        return JSONResponse(
            status_code=503, content={"detail": str(exc)}, headers={"Retry-After": "30"}
        )

    @app.exception_handler(UpstreamError)
    def _upstream(_: Request, exc: UpstreamError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    @app.get("/health", tags=["meta"])
    @limiter.exempt
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for r in (search.router, quotes.router, history.router, recommendations.router):
        app.include_router(r)

    return app


app = create_app()
