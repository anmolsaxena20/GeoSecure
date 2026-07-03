"""Live market data — fetch today's Brent from FRED's keyless CSV endpoint.

Cached for ~1 hour so we don't hammer FRED on every request. Falls back to the
price baked into the trained model if the network is unavailable, so the
service never hard-fails offline.
"""
from __future__ import annotations

import io
import time

import pandas as pd
import requests

from config import settings

_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU"
_CACHE: dict[str, float] = {"price": 0.0, "ts": 0.0}
_TTL_SECONDS = 3600.0


def get_latest_brent(force: bool = False) -> dict:
    """Return {'brent', 'as_of', 'source'} for the most recent Brent price."""
    now = time.monotonic()
    if not force and _CACHE["price"] and (now - _CACHE["ts"]) < _TTL_SECONDS:
        return {"brent": _CACHE["price"], "as_of": _CACHE.get("as_of", ""),
                "source": "cache"}
    try:
        r = requests.get(_CSV, headers={"User-Agent": "GeoSecureML/1.0"}, timeout=20)
        r.raise_for_status()
        df = pd.read_csv(io.StringIO(r.text))
        df.columns = ["date", "brent"]
        df["brent"] = pd.to_numeric(df["brent"], errors="coerce")
        df = df.dropna()
        price = float(df["brent"].iloc[-1])
        as_of = str(df["date"].iloc[-1])
        _CACHE.update({"price": price, "ts": now, "as_of": as_of})
        return {"brent": price, "as_of": as_of, "source": "fred_live"}
    except Exception as exc:  # noqa: BLE001 - stay up if offline
        return {"brent": None, "as_of": "", "source": f"unavailable ({exc})"}
