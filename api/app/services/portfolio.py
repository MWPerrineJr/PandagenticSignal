"""Portfolio analytics and Monte Carlo simulation. Pure numpy/pandas, no network.

Conventions: prices are daily closes; returns are log returns; `mu`/`cov` passed to the
simulators are already scaled to one simulation step. Everything is deterministic for a seed.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

TRADING_DAYS = 252
MIN_OBS = 30
DEFAULT_PERCENTILES: tuple[int, ...] = (5, 25, 50, 75, 95)


class InsufficientDataError(ValueError):
    """Too few overlapping observations to estimate anything."""


@dataclass(frozen=True)
class AssetStats:
    symbol: str
    weight: float
    annual_return: float
    annual_vol: float


@dataclass(frozen=True)
class PortfolioStats:
    annual_return: float
    annual_vol: float
    sharpe: float
    max_drawdown: float
    assets: list[AssetStats]
    correlation: list[list[float]]
    n_obs: int


@dataclass(frozen=True)
class PathSummary:
    times: list[float]
    bands: dict[str, list[float]]
    terminal: dict[str, float]


# -- data preparation -------------------------------------------------------------------------


def align_closes(frames: dict[str, pd.Series]) -> pd.DataFrame:
    """Inner-join close series on their index (dates), dropping rows with any gap.

    Stocks skip weekends and holidays while coins trade every day, so the join keeps only the
    days every asset has. Raises `InsufficientDataError` below `MIN_OBS` rows.
    """
    if not frames:
        raise InsufficientDataError("no price series given")
    df = pd.concat(frames, axis=1, join="inner").dropna()
    df.columns = list(frames)
    if len(df) < MIN_OBS:
        raise InsufficientDataError(
            f"need at least {MIN_OBS} overlapping trading days, got {len(df)}"
        )
    return df


def log_returns(closes: pd.DataFrame) -> pd.DataFrame:
    return np.log(closes).diff().dropna()


def shrink_covariance(cov: np.ndarray, n_obs: int, *, shrinkage: float | None = None) -> np.ndarray:
    """Shrink a sample covariance toward its diagonal (Ledoit-Wolf style, fixed target).

    Off-diagonal entries of a sample covariance are noisy when assets are many relative to the
    observations. With `shrinkage=None` the intensity is `n_assets / n_obs`, applied only for
    more than five assets; pass a value in [0, 1] to force it.
    """
    cov = np.atleast_2d(np.asarray(cov, dtype=float))
    n = cov.shape[0]
    if shrinkage is None:
        shrinkage = min(1.0, n / max(n_obs, 1)) if n > 5 else 0.0
    delta = float(np.clip(shrinkage, 0.0, 1.0))
    return (1 - delta) * cov + delta * np.diag(np.diag(cov))


# -- descriptive statistics -------------------------------------------------------------------


def max_drawdown(values: np.ndarray) -> float:
    """Largest peak-to-trough fall as a negative fraction (0 when values never fall)."""
    values = np.asarray(values, dtype=float)
    peaks = np.maximum.accumulate(values)
    return float(np.min(values / peaks - 1.0))


def portfolio_stats(
    returns: pd.DataFrame, weights: np.ndarray, *, periods_per_year: int = TRADING_DAYS
) -> PortfolioStats:
    """Annualised return/vol/Sharpe (rf = 0), drawdown, per-asset stats and correlation."""
    w = np.asarray(weights, dtype=float)
    if len(w) != returns.shape[1]:
        raise ValueError("one weight per asset is required")
    r = returns.to_numpy(dtype=float)
    port = r @ w
    ann_return = float(port.mean() * periods_per_year)
    ann_vol = float(port.std(ddof=1) * np.sqrt(periods_per_year)) if len(port) > 1 else 0.0
    sharpe = ann_return / ann_vol if ann_vol > 1e-12 else 0.0
    values = np.exp(np.concatenate([[0.0], np.cumsum(port)]))
    asset_mu = r.mean(axis=0) * periods_per_year
    asset_vol = r.std(axis=0, ddof=1) * np.sqrt(periods_per_year)
    corr = np.corrcoef(r, rowvar=False) if r.shape[1] > 1 else np.ones((1, 1))
    corr = np.nan_to_num(np.atleast_2d(corr), nan=0.0)
    np.fill_diagonal(corr, 1.0)
    return PortfolioStats(
        annual_return=ann_return,
        annual_vol=ann_vol,
        sharpe=float(sharpe),
        max_drawdown=max_drawdown(values),
        assets=[
            AssetStats(
                symbol=str(col),
                weight=float(w[i]),
                annual_return=float(asset_mu[i]),
                annual_vol=float(asset_vol[i]),
            )
            for i, col in enumerate(returns.columns)
        ],
        correlation=[[float(x) for x in row] for row in corr],
        n_obs=int(len(returns)),
    )


# -- simulation -------------------------------------------------------------------------------


def choose_step(horizon_years: float) -> tuple[int, int]:
    """(steps_per_year, n_steps): daily up to 2 years, weekly up to 10, monthly beyond.

    Keeps `n_steps` near or under ~520 so 10k paths x 20 assets stays cheap.
    """
    if horizon_years <= 2:
        spy = TRADING_DAYS
    elif horizon_years <= 10:
        spy = 52
    else:
        spy = 12
    return spy, max(1, round(horizon_years * spy))


def _factor(cov: np.ndarray) -> np.ndarray:
    """Cholesky factor, falling back to an eigen decomposition with negative modes clipped."""
    cov = np.atleast_2d(np.asarray(cov, dtype=float))
    try:
        return np.linalg.cholesky(cov)
    except np.linalg.LinAlgError:
        vals, vecs = np.linalg.eigh(cov)
        return vecs * np.sqrt(np.clip(vals, 0.0, None))


def simulate_portfolio(
    mu: np.ndarray,
    cov: np.ndarray,
    weights: np.ndarray,
    *,
    initial: float,
    n_steps: int,
    n_sims: int,
    cashflow_per_step: float = 0.0,
    seed: int | None = None,
) -> np.ndarray:
    """Correlated multi-asset paths, rebalanced to `weights` every step.

    `mu`/`cov` are per-step log-return moments. Returns an array of shape (n_sims, n_steps + 1)
    of portfolio values; `cashflow_per_step` is added after each step's growth and values are
    floored at zero (a withdrawal cannot overdraw).
    """
    mu = np.asarray(mu, dtype=float)
    w = np.asarray(weights, dtype=float)
    factor = _factor(cov)
    rng = np.random.default_rng(seed)
    paths = np.empty((n_sims, n_steps + 1), dtype=float)
    paths[:, 0] = initial
    for t in range(n_steps):
        z = rng.standard_normal((n_sims, len(mu)))
        growth = np.exp(mu + z @ factor.T) @ w
        paths[:, t + 1] = np.maximum(paths[:, t] * growth + cashflow_per_step, 0.0)
    return paths


def simulate_parametric(
    mu_annual: float,
    sigma_annual: float,
    *,
    initial: float,
    cashflows: np.ndarray | float,
    steps_per_year: int,
    n_sims: int,
    seed: int | None = None,
    floor_at_zero: bool = True,
) -> np.ndarray:
    """Single-asset GBM with a cashflow per step (positive = contribution, negative = withdrawal).

    `mu_annual` is the expected annual growth rate: with `sigma_annual = 0` a value compounds
    exactly at `(1 + mu_annual)` per year. `cashflows` is a scalar or an array of length
    `n_steps`; the number of steps comes from that array (scalar -> one year).
    """
    cf = np.atleast_1d(np.asarray(cashflows, dtype=float))
    n_steps = len(cf) if cf.shape[0] > 1 or not np.isscalar(cashflows) else steps_per_year
    if np.isscalar(cashflows):
        cf = np.full(n_steps, float(cashflows))
    drift = (np.log1p(mu_annual) - 0.5 * sigma_annual**2) / steps_per_year
    diffusion = sigma_annual / np.sqrt(steps_per_year)
    rng = np.random.default_rng(seed)
    paths = np.empty((n_sims, n_steps + 1), dtype=float)
    paths[:, 0] = initial
    for t in range(n_steps):
        shock = rng.standard_normal(n_sims) * diffusion if sigma_annual > 0 else 0.0
        nxt = paths[:, t] * np.exp(drift + shock) + cf[t]
        paths[:, t + 1] = np.maximum(nxt, 0.0) if floor_at_zero else nxt
    return paths


# -- summaries --------------------------------------------------------------------------------


def downsample_indices(n_steps: int, max_points: int = 260) -> np.ndarray:
    """Step indices to keep so a path has at most `max_points` samples (always first and last)."""
    if n_steps + 1 <= max_points:
        return np.arange(n_steps + 1)
    return np.unique(np.linspace(0, n_steps, max_points).round().astype(int))


def summarise_paths(
    paths: np.ndarray,
    *,
    baseline: float,
    steps_per_year: int,
    max_points: int = 260,
    percentiles: tuple[int, ...] = DEFAULT_PERCENTILES,
) -> PathSummary:
    """Percentile bands over time plus terminal-value risk statistics.

    `baseline` is the money put in (initial value plus contributions): losses, VaR and CVaR are
    measured against it.
    """
    n_steps = paths.shape[1] - 1
    idx = downsample_indices(n_steps, max_points)
    sampled = paths[:, idx]
    bands = {f"p{p}": [float(v) for v in np.percentile(sampled, p, axis=0)] for p in percentiles}
    terminal = paths[:, -1]
    p5 = float(np.percentile(terminal, 5))
    tail = terminal[terminal <= p5]
    var_95 = max(0.0, baseline - p5)
    cvar_95 = max(0.0, baseline - float(tail.mean())) if len(tail) else var_95
    return PathSummary(
        times=[float(i / steps_per_year) for i in idx],
        bands=bands,
        terminal={
            "mean": float(terminal.mean()),
            "median": float(np.median(terminal)),
            "p5": p5,
            "p25": float(np.percentile(terminal, 25)),
            "p75": float(np.percentile(terminal, 75)),
            "p95": float(np.percentile(terminal, 95)),
            "prob_loss": float(np.mean(terminal < baseline)),
            "var_95": var_95,
            "var_95_pct": var_95 / baseline if baseline > 0 else 0.0,
            "cvar_95": cvar_95,
        },
    )
