import numpy as np
import pandas as pd
import pytest

from app.services.portfolio import (
    MIN_OBS,
    InsufficientDataError,
    align_closes,
    choose_step,
    downsample_indices,
    log_returns,
    max_drawdown,
    portfolio_stats,
    shrink_covariance,
    simulate_parametric,
    simulate_portfolio,
    summarise_paths,
)


def _series(start: str, n: int, value=100.0, freq="D") -> pd.Series:
    return pd.Series(value, index=pd.date_range(start, periods=n, freq=freq))


# -- alignment ------------------------------------------------------------------------------


def test_align_closes_inner_joins_and_drops_gaps() -> None:
    stock = _series("2026-01-01", 60, freq="B")  # weekdays only, runs to late March
    coin = _series("2026-01-01", 70)  # every day, ends 11 March
    coin.iloc[5] = np.nan  # Tuesday 6 January
    df = align_closes({"AAPL": stock, "BTC-USD": coin})
    assert list(df.columns) == ["AAPL", "BTC-USD"]
    assert df.index.dayofweek.max() <= 4  # weekends gone
    assert df.isna().sum().sum() == 0
    assert len(df) < 60  # the NaN row and the days beyond the coin's range dropped


def test_align_closes_needs_min_obs() -> None:
    with pytest.raises(InsufficientDataError):
        align_closes({"A": _series("2026-01-01", MIN_OBS - 1), "B": _series("2026-01-01", 100)})
    with pytest.raises(InsufficientDataError):
        align_closes({})
    with pytest.raises(InsufficientDataError):
        align_closes({"A": _series("2026-01-01", 40), "B": _series("2027-01-01", 40)})


# -- stats ----------------------------------------------------------------------------------


def test_portfolio_stats_closed_form_on_constant_returns() -> None:
    idx = pd.date_range("2026-01-01", periods=100, freq="B")
    closes = pd.DataFrame({"A": 100 * np.exp(0.001 * np.arange(100))}, index=idx)
    rets = log_returns(closes)
    stats = portfolio_stats(rets, np.array([1.0]))
    assert stats.annual_return == pytest.approx(0.001 * 252)
    assert stats.annual_vol == pytest.approx(0.0, abs=1e-9)
    assert stats.sharpe == 0.0
    assert stats.max_drawdown == 0.0
    assert stats.assets[0].symbol == "A" and stats.assets[0].weight == 1.0
    assert stats.correlation == [[1.0]]
    assert stats.n_obs == 99


def test_portfolio_stats_two_assets() -> None:
    rng = np.random.default_rng(1)
    idx = pd.date_range("2026-01-01", periods=500, freq="B")
    a = rng.normal(0.0005, 0.01, 500)
    rets = pd.DataFrame({"A": a, "B": -a}, index=idx)  # perfectly anti-correlated
    stats = portfolio_stats(rets, np.array([0.5, 0.5]))
    assert stats.annual_vol == pytest.approx(0.0, abs=1e-9)
    assert stats.correlation[0][1] == pytest.approx(-1.0)
    assert stats.assets[1].annual_vol == pytest.approx(stats.assets[0].annual_vol)
    with pytest.raises(ValueError):
        portfolio_stats(rets, np.array([1.0]))


def test_max_drawdown() -> None:
    assert max_drawdown(np.array([1, 2, 1, 3])) == pytest.approx(-0.5)
    assert max_drawdown(np.array([1, 1.5, 2])) == 0.0


def test_shrink_covariance() -> None:
    assert shrink_covariance(np.float64(2.0), 50).shape == (1, 1)  # single asset
    cov = np.array([[4.0, 1.0], [1.0, 9.0]])
    assert np.allclose(shrink_covariance(cov, 100, shrinkage=0.0), cov)
    assert np.allclose(shrink_covariance(cov, 100, shrinkage=1.0), np.diag([4.0, 9.0]))
    half = shrink_covariance(cov, 100, shrinkage=0.5)
    assert half[0, 1] == pytest.approx(0.5) and half[0, 0] == 4.0
    assert np.allclose(shrink_covariance(cov, 10), cov)  # <= 5 assets: off by default
    big = np.full((6, 6), 0.5) + np.eye(6) * 0.5
    shrunk = shrink_covariance(big, 60)  # 6/60 = 0.1
    assert shrunk[0, 1] == pytest.approx(0.45)
    assert np.all(np.linalg.eigvalsh(shrunk) > 0)


# -- simulation -----------------------------------------------------------------------------


def test_choose_step() -> None:
    assert choose_step(1) == (252, 252)
    assert choose_step(2) == (252, 504)
    assert choose_step(5) == (52, 260)
    assert choose_step(10) == (52, 520)
    assert choose_step(30) == (12, 360)
    assert choose_step(0.01) == (252, 3)


def test_simulate_portfolio_reproduces_input_correlation_and_seed() -> None:
    corr = 0.6
    vol = np.array([0.01, 0.02])
    cov = np.outer(vol, vol) * np.array([[1, corr], [corr, 1]])
    mu = np.array([0.0004, 0.0002])
    w = np.array([0.5, 0.5])
    a = simulate_portfolio(mu, cov, w, initial=1000, n_steps=300, n_sims=4000, seed=7)
    b = simulate_portfolio(mu, cov, w, initial=1000, n_steps=300, n_sims=4000, seed=7)
    assert a.shape == (4000, 301)
    assert np.array_equal(a, b)
    assert (a[:, 0] == 1000).all()
    # Rebuild single-asset paths to check the correlation of simulated returns.
    rng = np.random.default_rng(7)
    z = rng.standard_normal((200_000, 2))
    r = mu + z @ np.linalg.cholesky(cov).T
    assert np.corrcoef(r, rowvar=False)[0, 1] == pytest.approx(corr, abs=0.01)
    # Portfolio drift lands where the moments say it should.
    expected = 1000 * (w @ np.exp(mu + np.diag(cov) / 2)) ** 300
    assert a[:, -1].mean() == pytest.approx(expected, rel=0.05)


def test_simulate_portfolio_cashflows_and_floor() -> None:
    mu, cov, w = np.array([0.0]), np.array([[0.0]]), np.array([1.0])
    up = simulate_portfolio(mu, cov, w, initial=100, n_steps=10, n_sims=3, cashflow_per_step=5)
    assert np.allclose(up[:, -1], 150)
    down = simulate_portfolio(mu, cov, w, initial=100, n_steps=30, n_sims=3, cashflow_per_step=-5)
    assert np.allclose(down[:, 20], 0) and (down >= 0).all()


def test_simulate_portfolio_handles_non_positive_definite_cov() -> None:
    cov = np.array([[1.0, 1.0], [1.0, 1.0]]) * 1e-4  # singular: perfectly correlated
    paths = simulate_portfolio(
        np.zeros(2), cov, np.array([0.5, 0.5]), initial=1, n_steps=5, n_sims=10, seed=1
    )
    assert np.isfinite(paths).all()


def test_simulate_parametric_compounds_exactly_without_volatility() -> None:
    paths = simulate_parametric(
        0.07, 0.0, initial=1000, cashflows=np.zeros(24), steps_per_year=12, n_sims=2
    )
    assert paths.shape == (2, 25)
    assert paths[0, -1] == pytest.approx(1000 * 1.07**2)
    with_cf = simulate_parametric(
        0.0, 0.0, initial=1000, cashflows=np.full(12, 100.0), steps_per_year=12, n_sims=1
    )
    assert with_cf[0, -1] == pytest.approx(2200)


def test_simulate_parametric_withdrawals_floor_and_seed() -> None:
    cf = np.full(120, -50.0)
    a = simulate_parametric(
        0.05, 0.15, initial=1000, cashflows=cf, steps_per_year=12, n_sims=500, seed=3
    )
    b = simulate_parametric(
        0.05, 0.15, initial=1000, cashflows=cf, steps_per_year=12, n_sims=500, seed=3
    )
    assert np.array_equal(a, b)
    assert (a >= 0).all() and (a[:, -1] == 0).any()
    raw = simulate_parametric(
        0.0, 0.0, initial=100, cashflows=cf[:3], steps_per_year=12, n_sims=1, floor_at_zero=False
    )
    assert raw[0, -1] == pytest.approx(-50)
    scalar = simulate_parametric(0.0, 0.0, initial=100, cashflows=10.0, steps_per_year=4, n_sims=1)
    assert scalar.shape == (1, 5) and scalar[0, -1] == 140


# -- summaries ------------------------------------------------------------------------------


def test_downsample_indices() -> None:
    assert list(downsample_indices(10, 260)) == list(range(11))
    idx = downsample_indices(5000, 260)
    assert len(idx) <= 260 and idx[0] == 0 and idx[-1] == 5000
    assert np.all(np.diff(idx) > 0)


def test_summarise_paths_bands_and_terminal_stats() -> None:
    rng = np.random.default_rng(0)
    paths = np.cumprod(1 + rng.normal(0.001, 0.02, (2000, 600)), axis=1) * 100
    paths = np.hstack([np.full((2000, 1), 100.0), paths])
    s = summarise_paths(paths, baseline=100, steps_per_year=52)
    assert len(s.times) <= 260 and s.times[0] == 0 and s.times[-1] == pytest.approx(600 / 52)
    assert set(s.bands) == {"p5", "p25", "p50", "p75", "p95"}
    for i in range(len(s.times)):
        assert s.bands["p5"][i] <= s.bands["p25"][i] <= s.bands["p50"][i]
        assert s.bands["p50"][i] <= s.bands["p75"][i] <= s.bands["p95"][i]
    t = s.terminal
    assert 0 <= t["prob_loss"] <= 1
    assert t["p5"] <= t["median"] <= t["p95"]
    assert t["var_95"] == pytest.approx(max(0, 100 - t["p5"]))
    assert t["cvar_95"] >= t["var_95"]
    assert t["var_95_pct"] == pytest.approx(t["var_95"] / 100)


def test_summarise_paths_no_loss_when_paths_only_rise() -> None:
    paths = np.tile(np.linspace(100, 200, 11), (5, 1))
    s = summarise_paths(paths, baseline=100, steps_per_year=1)
    assert s.terminal["prob_loss"] == 0 and s.terminal["var_95"] == 0 and s.terminal["cvar_95"] == 0
