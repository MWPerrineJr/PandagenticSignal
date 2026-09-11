"""Portfolio analytics: descriptive stats and a correlated Monte Carlo projection."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter

from app.deps import MarketDataDep
from app.schemas import (
    AssetStatsOut,
    PortfolioRequest,
    PortfolioStatsOut,
    SimulateRequest,
    SimulationOut,
)
from app.services.market_data import MarketData
from app.services.portfolio import (
    TRADING_DAYS,
    PortfolioStats,
    choose_step,
    log_returns,
    portfolio_stats,
    shrink_covariance,
    simulate_portfolio,
    summarise_paths,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _analyse(
    md: MarketData, req: PortfolioRequest
) -> tuple[PortfolioStatsOut, pd.DataFrame, PortfolioStats]:
    symbols, weights = req.symbols_and_weights()
    closes = md.closes(symbols, period=req.period)
    returns = log_returns(closes)
    stats = portfolio_stats(returns, np.array(weights))
    out = PortfolioStatsOut(
        symbols=symbols,
        weights=weights,
        period=req.period,
        start=closes.index[0].date().isoformat(),
        end=closes.index[-1].date().isoformat(),
        n_obs=stats.n_obs,
        annual_return=stats.annual_return,
        annual_vol=stats.annual_vol,
        sharpe=stats.sharpe,
        max_drawdown=stats.max_drawdown,
        assets=[AssetStatsOut(**vars(a)) for a in stats.assets],
        correlation=stats.correlation,
    )
    return out, returns, stats


@router.post("/analyse", response_model=PortfolioStatsOut)
def analyse(req: PortfolioRequest, md: MarketDataDep) -> PortfolioStatsOut:
    out, _, _ = _analyse(md, req)
    return out


@router.post("/simulate", response_model=SimulationOut)
def simulate(req: SimulateRequest, md: MarketDataDep) -> SimulationOut:
    out, returns, stats = _analyse(md, req)
    steps_per_year, n_steps = choose_step(req.horizon_years)
    scale = TRADING_DAYS / steps_per_year  # daily moments -> one simulation step
    r = returns.to_numpy(dtype=float)
    mu = r.mean(axis=0) * scale
    cov = shrink_covariance(np.cov(r, rowvar=False, ddof=1), stats.n_obs) * scale
    cashflow = req.monthly_contribution * 12 / steps_per_year
    paths = simulate_portfolio(
        mu,
        np.atleast_2d(cov),
        np.array(out.weights),
        initial=req.initial_value,
        n_steps=n_steps,
        n_sims=req.n_sims,
        cashflow_per_step=cashflow,
        seed=req.seed,
    )
    summary = summarise_paths(
        paths, baseline=req.initial_value + cashflow * n_steps, steps_per_year=steps_per_year
    )
    return SimulationOut(
        initial_value=req.initial_value,
        horizon_years=req.horizon_years,
        steps_per_year=steps_per_year,
        n_sims=req.n_sims,
        times=summary.times,
        bands=summary.bands,
        terminal=summary.terminal,
        stats=out,
    )
