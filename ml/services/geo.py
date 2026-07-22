"""Stage 3 support — geospatial risk aggregation for the dashboard map.

Turns a set of scored news items into a per-chokepoint risk layer the frontend
can render: each chokepoint gets a 0-10 risk, a colour, its bbox/center, and
the headlines driving it. Corridors above the alert threshold are tinted red.
"""
from __future__ import annotations

from config import settings

ALERT_THRESHOLD = 7

_chokepoints = settings.load_config("chokepoints")["chokepoints"]


def _colour(risk: float) -> str:
    if risk >= ALERT_THRESHOLD:
        return "#e02424"   # red
    if risk >= 4:
        return "#f59e0b"   # amber
    return "#22c55e"       # green


def risk_layer(scored_items: list[dict]) -> dict:
    """scored_items: output of services.classifier.score_batch."""
    by_cp: dict[str, list[dict]] = {c["id"]: [] for c in _chokepoints}
    for it in scored_items:
        loc = it.get("location", "unknown")
        if loc in by_cp:
            by_cp[loc].append(it)

    features = []
    for cp in _chokepoints:
        items = by_cp[cp["id"]]
        # risk = max severity seen, nudged up by volume of corroborating reports
        sev = max((i["severity"] for i in items), default=0)
        risk = min(10, sev + (0.5 if len(items) >= 3 else 0))
        features.append({
            "id": cp["id"],
            "name": cp["name"],
            "center": cp["center"],
            "bbox": cp["bbox"],
            "daily_oil_mbd": cp["daily_oil_mbd"],
            "risk": round(risk, 1),
            "colour": _colour(risk),
            "alert": risk >= ALERT_THRESHOLD,
            "report_count": len(items),
            "top_headlines": [i["text"] for i in sorted(
                items, key=lambda x: -x["severity"])[:3]],
        })

    alerts = [f["id"] for f in features if f["alert"]]
    return {
        "alert_threshold": ALERT_THRESHOLD,
        "active_alerts": alerts,
        "chokepoints": features,
    }


if __name__ == "__main__":
    import json
    demo = [
        {"location": "hormuz", "severity": 9, "text": "Missile strike near Hormuz"},
        {"location": "hormuz", "severity": 7, "text": "Gulf tanker rerouted"},
        {"location": "bab_el_mandeb", "severity": 5, "text": "Red Sea drone warning"},
    ]
    print(json.dumps(risk_layer(demo), indent=2))
