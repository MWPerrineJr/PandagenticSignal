from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import MarketDataDep
from app.schemas import SearchResult

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchResult])
def search(
    q: Annotated[str, Query(min_length=1, max_length=64)],
    md: MarketDataDep,
    limit: Annotated[int, Query(ge=1, le=25)] = 8,
) -> list[SearchResult]:
    return md.search(q, limit=limit)
