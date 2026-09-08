from fastapi import APIRouter

from app.deps import MarketDataDep
from app.schemas import Recommendations

router = APIRouter(tags=["analysts"])


@router.get("/recommendations/{ticker}", response_model=Recommendations)
def recommendations(ticker: str, md: MarketDataDep) -> Recommendations:
    return Recommendations(**md.recommendations(ticker))
