"""Fetch daily Brent crude spot prices from FRED.

Uses the keyless CSV endpoint (works with no API key). Series DCOILBRENTEU =
'Crude Oil Prices: Brent - Europe' (USD/barrel, daily).
"""
from __future__ import annotations

import io
import sys

import pandas as pd
import requests

from config import settings

SERIES_ID = "DCOILBRENTEU"
CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + SERIES_ID


def fetch_brent() -> pd.DataFrame:
    """Return a DataFrame with columns ['date', 'brent'] (NaNs dropped)."""
    resp = requests.get(CSV_URL, headers={"User-Agent": "GeoSecureML/1.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    df.columns = ["date", "brent"]
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["brent"] = pd.to_numeric(df["brent"], errors="coerce")
    df = df.dropna().reset_index(drop=True)
    return df


def main() -> None:
    settings.ensure_dirs()
    df = fetch_brent()
    out = settings.DATA_RAW / "brent_prices.csv"
    df.to_csv(out, index=False)
    print(f"[fetch_fred] saved {len(df)} rows ({df['date'].min().date()} to "
          f"{df['date'].max().date()}) -> {out}")


if __name__ == "__main__":
    sys.exit(main())
