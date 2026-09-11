"""Retirement projection: deterministic path plus Monte Carlo success probability."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from app.deps import MarketDataDep
from app.schemas import (
    PortfolioRequest,
    RetirementAssumptions,
    RetirementMonteCarlo,
    RetirementOut,
    RetirementRequest,
    YearPointOut,
)
from app.services.portfolio import log_returns, portfolio_stats
from app.services.retirement import (
    RATE_BOUNDS,
    RetirementInputs,
    arithmetic_from_log,
    project_deterministic,
    simulate_retirement,
)

router = APIRouter(prefix="/retirement", tags=["retirement"])


def _assumptions(req: RetirementRequest, md) -> RetirementAssumptions:
    if req.mode == "parametric":
        return RetirementAssumptions(
            mu=req.expected_return, sigma=req.volatility, source="parametric"
        )
    pf = PortfolioRequest(holdings=req.holdings or [], period=req.period)
    symbols, weights = pf.symbols_and_weights()
    stats = portfolio_stats(log_returns(md.closes(symbols, period=req.period)), np.array(weights))
    # History can imply absurd growth (a short window of one hot asset); keep the projection sane.
    mu = float(np.clip(arithmetic_from_log(stats.annual_return, stats.annual_vol), *RATE_BOUNDS))
    return RetirementAssumptions(
        mu=mu, sigma=float(min(stats.annual_vol, 1.0)), source="portfolio", symbols=symbols
    )


@router.post("/project", response_model=RetirementOut)
def project(req: RetirementRequest, md: MarketDataDep) -> RetirementOut:
    assumptions = _assumptions(req, md)
    inputs = RetirementInputs(
        current_age=req.current_age,
        retirement_age=req.retirement_age,
        life_expectancy=req.life_expectancy,
        current_savings=req.current_savings,
        monthly_contribution=req.monthly_contribution,
        expected_return=assumptions.mu,
        inflation=req.inflation,
        annual_spending=req.annual_spending,
    )
    deterministic = project_deterministic(inputs)
    sim = simulate_retirement(
        inputs, mu=assumptions.mu, sigma=assumptions.sigma, n_sims=req.n_sims, seed=req.seed
    )
    return RetirementOut(
        assumptions=assumptions,
        deterministic=[YearPointOut(**vars(p)) for p in deterministic],
        monte_carlo=RetirementMonteCarlo(
            success_probability=sim.success_probability,
            ages=sim.ages,
            bands=sim.bands,
            median_depletion_age=sim.median_depletion_age,
            terminal=sim.summary.terminal,
            n_sims=sim.n_sims,
        ),
    )
