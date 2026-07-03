"""One-command build: fetch real data -> label -> train both models.

Usage:  python pipeline.py            (full pipeline)
        python pipeline.py --no-fetch (reuse cached raw data, just re-train)
"""
from __future__ import annotations

import sys

from config import settings


def run(fetch: bool = True) -> None:
    settings.ensure_dirs()

    if fetch:
        print("== [1/5] FRED Brent prices ==")
        from data import fetch_fred
        fetch_fred.main()

        print("\n== [2/5] GDELT geopolitical corpus (throttled ~2 min) ==")
        from data import fetch_gdelt
        fetch_gdelt.main()
    else:
        print("== skipping fetch (using cached raw data) ==")

    print("\n== [3/5] Clean + weak-label dataset ==")
    from data import build_dataset
    build_dataset.main()

    print("\n== [4/5] Train threat classifier ==")
    from models import train_classifier
    train_classifier.train()

    print("\n== [5/5] Train price-shock forecaster ==")
    from models import train_price
    train_price.train()

    print("\nDone. Start the service with:  uvicorn app.main:app --port 8001")


if __name__ == "__main__":
    run(fetch="--no-fetch" not in sys.argv)
