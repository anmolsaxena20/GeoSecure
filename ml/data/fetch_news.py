"""Live news feed via NewsAPI — used only for the real-time demo, not training.

Requires NEWSAPI_KEY in .env. If absent, callers should fall back to GDELT or
the bundled sample headlines so the demo never hard-crashes.
"""
from __future__ import annotations

import requests

from config import settings

ENDPOINT = "https://newsapi.org/v2/everything"
DEFAULT_QUERY = (
    '("strait of hormuz" OR "red sea" OR "bab el mandeb" OR "suez canal" OR '
    '"crude oil" OR tanker OR refinery) AND (attack OR sanction OR blockade OR '
    'strike OR closure OR disruption)'
)

# Used when no API key is configured, so /score-news/live still returns something.
SAMPLE_HEADLINES = [
    "Missile strike near Strait of Hormuz raises fears of oil supply disruption",
    "Houthi drones hit tanker in the Red Sea, shipping firms reroute via Cape",
    "New sanctions target Russian crude exports, prices climb",
    "OPEC+ holds output steady amid Gulf tensions",
    "Refinery in Gujarat resumes normal run rate after maintenance",
]


def fetch_live(query: str = DEFAULT_QUERY, page_size: int = 20) -> list[dict]:
    """Return [{'title','description','url','publishedAt'}]. Empty list on failure."""
    if not settings.NEWSAPI_KEY:
        return [{"title": h, "description": "", "url": "", "publishedAt": ""}
                for h in SAMPLE_HEADLINES]
    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": page_size,
        "apiKey": settings.NEWSAPI_KEY,
    }
    try:
        r = requests.get(ENDPOINT, params=params, timeout=30)
        r.raise_for_status()
        arts = r.json().get("articles", [])
    except Exception as exc:  # noqa: BLE001
        print(f"[fetch_news] live fetch failed ({exc}); using sample headlines")
        return [{"title": h, "description": "", "url": "", "publishedAt": ""}
                for h in SAMPLE_HEADLINES]
    return [
        {
            "title": a.get("title") or "",
            "description": a.get("description") or "",
            "url": a.get("url") or "",
            "publishedAt": a.get("publishedAt") or "",
        }
        for a in arts
        if a.get("title")
    ]


if __name__ == "__main__":
    for art in fetch_live():
        print("-", art["title"])
