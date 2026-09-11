"""Lenient scalar conversions shared by the market-data services."""

from __future__ import annotations

import math
from typing import Any


def _num(value: Any) -> float | None:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _price(value: Any) -> float | None:
    """Analyst price fields: Yahoo encodes "no target" as 0, which is never a real price."""
    f = _num(value)
    return f if f is not None and f > 0 else None


def _int(value: Any) -> int | None:
    f = _num(value)
    return int(f) if f is not None else None


def _str(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return str(value)
