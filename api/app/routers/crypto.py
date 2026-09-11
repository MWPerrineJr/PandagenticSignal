from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import MarketDataDep
from app.schemas import CryptoTop

router = APIRouter(tags=["crypto"])


@router.get("/crypto/top", response_model=CryptoTop)
def top(
    md: MarketDataDep,
    limit: Annotated[int, Query(ge=1, le=100, description="Coins to return, by market cap")] = 25,
) -> CryptoTop:
    return md.top_crypto(limit)
