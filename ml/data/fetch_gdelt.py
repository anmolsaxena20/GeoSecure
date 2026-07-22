"""Fetch a geopolitical/maritime news corpus from GDELT 2.0 Doc API (keyless).

GDELT enforces ~1 request / 5 seconds, so we throttle. We sweep several
energy / chokepoint queries and collect article title, url, domain, date and
tone (GDELT's sentiment score; more negative = more hostile coverage).
"""
from __future__ import annotations

import sys
import time

import pandas as pd
import requests

from config import settings

API = "https://api.gdeltproject.org/api/v2/doc/doc"

# Query themes that surface supply-chain / energy threat coverage.
# Phrase-quoted so GDELT treats them as phrases (avoids 'keyword too short').
QUERIES = [
    '"strait of hormuz"',
    '"red sea" shipping',
    '"red sea" tanker',
    '"suez canal"',
    '"strait of malacca"',
    '"crude oil" sanctions',
    '"oil tanker" seized',
    '"opec" oil supply',
    '"iran" oil export',
    '"russia" oil sanctions',
    '"oil pipeline" attack',
    '"refinery" fire',
    '"persian gulf" tension',
    '"houthi" shipping',
]

_last_call = [0.0]


def _throttle() -> None:
    elapsed = time.monotonic() - _last_call[0]
    wait = settings.GDELT_MIN_INTERVAL - elapsed
    if wait > 0:
        time.sleep(wait)
    _last_call[0] = time.monotonic()


def _query(q: str, timespan: str = "3m", maxrecords: int = 75, retries: int = 4) -> list[dict]:
    params = {
        # sourcelang:english keeps the corpus in one language so the English
        # classifier + LLM labeller stay reliable (non-English titles were
        # mislabelled and poisoned training).
        "query": f"{q} sourcelang:english",
        "mode": "artlist",
        "maxrecords": maxrecords,
        "format": "json",
        "timespan": timespan,
        "sort": "hybridrel",
    }
    headers = {"User-Agent": "GeoSecureML/1.0"}
    for attempt in range(retries):
        _throttle()
        try:
            r = requests.get(API, params=params, headers=headers, timeout=40)
        except Exception as exc:  # noqa: BLE001 - keep the sweep resilient
            print(f"  [warn] query {q!r} failed: {exc}")
            return []
        if r.status_code == 429 or "limit requests" in r.text[:80].lower():
            time.sleep(settings.GDELT_MIN_INTERVAL + 3)  # back off and retry
            continue
        if r.status_code != 200 or not r.text.strip().startswith("{"):
            print(f"  [warn] query {q!r} -> HTTP {r.status_code}: {r.text[:70]}")
            return []
        arts = r.json().get("articles", [])
        for a in arts:
            a["_query"] = q
        return arts
    print(f"  [warn] query {q!r} -> gave up after {retries} retries (rate-limited)")
    return []


def fetch_corpus(timespan: str = "3m") -> pd.DataFrame:
    rows: list[dict] = []
    for q in QUERIES:
        arts = _query(q, timespan=timespan)
        print(f"  [gdelt] '{q}': {len(arts)} articles")
        rows.extend(arts)
    if not rows:
        return pd.DataFrame(columns=["title", "url", "domain", "seendate", "tone", "_query"])
    df = pd.DataFrame(rows)
    keep = [c for c in ["title", "url", "domain", "seendate", "tone", "_query"] if c in df.columns]
    df = df[keep].copy()
    if "tone" in df.columns:
        df["tone"] = pd.to_numeric(df["tone"], errors="coerce")
    df = df.dropna(subset=["title"]).drop_duplicates(subset=["title"]).reset_index(drop=True)
    return df


def main() -> None:
    settings.ensure_dirs()
    df = fetch_corpus()
    out = settings.DATA_RAW / "gdelt_corpus.csv"
    df.to_csv(out, index=False)
    print(f"[fetch_gdelt] saved {len(df)} unique articles to {out}")


if __name__ == "__main__":
    sys.exit(main())
