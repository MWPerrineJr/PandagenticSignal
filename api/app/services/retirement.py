"""Retirement projection: a deterministic nest-egg path and a Monte Carlo success probability.

Money is in today's dollars for inputs (`annual_spending`); withdrawals grow with inflation and
the Monte Carlo bands are reported in real terms so they read against today's spending.
Yearly steps: contributions arrive while `age < retirement_age`, withdrawals from then on.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.services.portfolio import PathSummary, simulate_parametric, summarise_paths

MAX_AGE = 110
RATE_BOUNDS = (-0.5, 0.5)


@dataclass(frozen=True)
class RetirementInputs:
    current_age: int
    retirement_age: int
    life_expectancy: int
    current_savings: float
    monthly_contribution: float
    expected_return: float  # arithmetic annual growth, e.g. 0.06
    inflation: float  # e.g. 0.025
    annual_spending: float  # in today's dollars

    def __post_init__(self) -> None:
        if not 0 <= self.current_age < self.retirement_age < self.life_expectancy <= MAX_AGE:
            raise ValueError(
                "ages must satisfy current_age < retirement_age < life_expectancy <= 110"
            )
        for name in ("expected_return", "inflation"):
            v = getattr(self, name)
            if not RATE_BOUNDS[0] <= v <= RATE_BOUNDS[1]:
                raise ValueError(f"{name} must be between -50% and 50%")
        for name in ("current_savings", "monthly_contribution", "annual_spending"):
            if getattr(self, name) < 0:
                raise ValueError(f"{name} must not be negative")

    @property
    def n_years(self) -> int:
        return self.life_expectancy - self.current_age


@dataclass(frozen=True)
class YearPoint:
    age: int
    year: int
    balance_nominal: float
    balance_real: float
    cashflow: float


@dataclass(frozen=True)
class RetirementSim:
    success_probability: float
    ages: list[int]
    bands: dict[str, list[float]]  # real (today's dollars)
    median_depletion_age: int | None
    summary: PathSummary
    n_sims: int


def cashflows(inputs: RetirementInputs) -> np.ndarray:
    """One nominal cashflow per year, applied at the end of year `t` (t = 1..n_years)."""
    out = np.empty(inputs.n_years, dtype=float)
    for t in range(inputs.n_years):
        age = inputs.current_age + t  # age during this year
        if age < inputs.retirement_age:
            out[t] = 12 * inputs.monthly_contribution
        else:
            out[t] = -inputs.annual_spending * (1 + inputs.inflation) ** (t + 1)
    return out


def deflators(inputs: RetirementInputs) -> np.ndarray:
    """(1 + inflation)^t for t = 0..n_years, to convert nominal balances to today's dollars."""
    return (1 + inputs.inflation) ** np.arange(inputs.n_years + 1, dtype=float)


def project_deterministic(
    inputs: RetirementInputs, expected_return: float | None = None
) -> list[YearPoint]:
    """Balance at each birthday from now to life expectancy at a fixed annual return."""
    r = inputs.expected_return if expected_return is None else expected_return
    flows = cashflows(inputs)
    deflate = deflators(inputs)
    balance = float(inputs.current_savings)
    points = [YearPoint(inputs.current_age, 0, balance, balance, 0.0)]
    for t, cf in enumerate(flows, start=1):
        balance = max(0.0, balance * (1 + r) + float(cf))
        points.append(
            YearPoint(
                age=inputs.current_age + t,
                year=t,
                balance_nominal=balance,
                balance_real=balance / float(deflate[t]),
                cashflow=float(cf),
            )
        )
    return points


def simulate_retirement(
    inputs: RetirementInputs,
    *,
    mu: float,
    sigma: float,
    n_sims: int = 2000,
    seed: int | None = None,
) -> RetirementSim:
    """Yearly GBM paths with the plan's cashflows; success = money left at life expectancy."""
    flows = cashflows(inputs)
    paths = simulate_parametric(
        mu,
        sigma,
        initial=inputs.current_savings,
        cashflows=flows,
        steps_per_year=1,
        n_sims=n_sims,
        seed=seed,
    )
    real = paths / deflators(inputs)
    contributed = inputs.current_savings + float(np.clip(flows, 0, None).sum())
    summary = summarise_paths(real, baseline=max(contributed, 1e-9), steps_per_year=1)

    terminal = paths[:, -1]
    success = float(np.mean(terminal > 0))
    retire_idx = inputs.retirement_age - inputs.current_age
    after = paths[:, retire_idx:]
    depleted = (after <= 0).any(axis=1)
    median_depletion: int | None = None
    if depleted.any():
        first_zero = np.argmax(after[depleted] <= 0, axis=1) + retire_idx
        median_depletion = int(round(float(np.median(first_zero)))) + inputs.current_age

    ages = [inputs.current_age + int(round(t)) for t in summary.times]
    return RetirementSim(
        success_probability=success,
        ages=ages,
        bands=summary.bands,
        median_depletion_age=median_depletion,
        summary=summary,
        n_sims=n_sims,
    )


def arithmetic_from_log(mu_log: float, sigma: float) -> float:
    """Expected annual growth implied by log-return moments: exp(mu + sigma^2 / 2) - 1."""
    return float(np.exp(mu_log + 0.5 * sigma**2) - 1.0)
