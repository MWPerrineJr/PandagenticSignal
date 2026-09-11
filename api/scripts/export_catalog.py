"""Write the indicator catalog to the frontend test fixtures.

Run from `api/`: `uv run python scripts/export_catalog.py`. The unit test
`test_catalog_fixture_is_current` fails when this file is stale, so the MSW handler, the picker
tests and the FAQ can never describe indicators the API does not have.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas import IndicatorCatalog
from app.services import indicators as ind

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "src" / "test" / "fixtures" / "indicator-catalog.json"


def catalog_json() -> str:
    cat = IndicatorCatalog(
        indicators=ind.catalog(),
        defaults=list(ind.DEFAULT_TOKENS),
        max_per_request=ind.MAX_INDICATORS_PER_REQUEST,
    )
    return json.dumps(cat.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    FIXTURE.write_text(catalog_json())
    print(f"wrote {FIXTURE}")
