from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.errors import RateLimitedError, TickerNotFoundError, UpstreamError
from app.routers import history, quotes, recommendations, search
from app.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Stock Analysis API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET"],
        allow_headers=["*"],
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
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for r in (search.router, quotes.router, history.router, recommendations.router):
        app.include_router(r)

    return app


app = create_app()
