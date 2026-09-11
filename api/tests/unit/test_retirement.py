import numpy as np
import pytest

from app.services.retirement import (
    RetirementInputs,
    arithmetic_from_log,
    cashflows,
    project_deterministic,
    simulate_retirement,
)


def make(**overrides) -> RetirementInputs:
    base = dict(
        current_age=40,
        retirement_age=45,
        life_expectancy=50,
        current_savings=100_000.0,
        monthly_contribution=1_000.0,
        expected_return=0.0,
        inflation=0.0,
        annual_spending=30_000.0,
    )
    return RetirementInputs(**{**base, **overrides})


def test_validation() -> None:
    with pytest.raises(ValueError, match="ages"):
        make(retirement_age=40)
    with pytest.raises(ValueError, match="ages"):
        make(life_expectancy=45)
    with pytest.raises(ValueError, match="ages"):
        make(life_expectancy=111)
    with pytest.raises(ValueError, match="expected_return"):
        make(expected_return=0.6)
    with pytest.raises(ValueError, match="inflation"):
        make(inflation=-0.6)
    with pytest.raises(ValueError, match="negative"):
        make(current_savings=-1)
    assert make().n_years == 10


def test_cashflows_contribute_until_retirement_then_withdraw_inflated() -> None:
    flows = cashflows(make(inflation=0.10))
    assert flows[:5].tolist() == [12_000.0] * 5  # ages 40..44 working
    assert flows[5] == pytest.approx(-30_000 * 1.1**6)  # first retired year, inflated
    assert flows[9] == pytest.approx(-30_000 * 1.1**10)
    assert len(flows) == 10


def test_deterministic_zero_rates_is_plain_arithmetic() -> None:
    pts = project_deterministic(make())
    assert [p.age for p in pts] == list(range(40, 51))
    assert pts[0].balance_nominal == 100_000 and pts[0].cashflow == 0
    assert pts[5].balance_nominal == pytest.approx(160_000)  # 5 years of 12k
    assert pts[10].balance_nominal == pytest.approx(160_000 - 5 * 30_000)
    assert all(p.balance_real == p.balance_nominal for p in pts)  # no inflation


def test_deterministic_growth_inflation_and_floor() -> None:
    pts = project_deterministic(make(expected_return=0.05, inflation=0.02, annual_spending=200_000))
    assert pts[1].balance_nominal == pytest.approx(100_000 * 1.05 + 12_000)
    assert pts[1].balance_real == pytest.approx(pts[1].balance_nominal / 1.02)
    assert pts[-1].balance_nominal == 0.0  # spending exhausts the pot; never negative
    assert min(p.balance_nominal for p in pts) == 0.0
    override = project_deterministic(make(), expected_return=0.10)
    assert override[1].balance_nominal == pytest.approx(110_000 + 12_000)


def test_simulation_without_volatility_matches_deterministic() -> None:
    inputs = make(expected_return=0.04, inflation=0.02)
    sim = simulate_retirement(inputs, mu=0.04, sigma=0.0, n_sims=50, seed=1)
    det = project_deterministic(inputs)
    assert sim.success_probability == 1.0
    assert sim.median_depletion_age is None
    assert sim.ages == [p.age for p in det]
    assert sim.bands["p50"] == pytest.approx([p.balance_real for p in det])
    assert sim.bands["p5"] == pytest.approx(sim.bands["p95"])
    assert sim.n_sims == 50


def test_simulation_insufficient_savings_fails_every_path() -> None:
    inputs = make(annual_spending=500_000)
    sim = simulate_retirement(inputs, mu=0.0, sigma=0.0, n_sims=20, seed=1)
    assert sim.success_probability == 0.0
    assert sim.median_depletion_age == 46  # 160k lasts less than one year of 500k spending
    assert sim.bands["p50"][-1] == 0.0


def test_simulation_is_seeded_and_probability_is_between_extremes() -> None:
    inputs = make(expected_return=0.05, annual_spending=45_000)
    a = simulate_retirement(inputs, mu=0.05, sigma=0.15, n_sims=2000, seed=7)
    b = simulate_retirement(inputs, mu=0.05, sigma=0.15, n_sims=2000, seed=7)
    assert a == b
    assert 0.0 < a.success_probability < 1.0
    assert a.median_depletion_age is not None and 45 <= a.median_depletion_age <= 50
    assert set(a.bands) == {"p5", "p25", "p50", "p75", "p95"}
    assert all(np.diff([a.bands[k][-1] for k in ("p5", "p25", "p50", "p75", "p95")]) >= 0)
    assert 0 <= a.summary.terminal["prob_loss"] <= 1


def test_arithmetic_from_log() -> None:
    assert arithmetic_from_log(0.0, 0.0) == 0.0
    assert arithmetic_from_log(np.log(1.07), 0.0) == pytest.approx(0.07)
    assert arithmetic_from_log(0.05, 0.2) == pytest.approx(np.exp(0.07) - 1)
