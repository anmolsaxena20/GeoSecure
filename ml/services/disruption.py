"""Stage 2 — Disruption Scenario Modeller.

Translates a threat severity on a specific chokepoint into cascading physical
and economic effects, using the calibrated sensitivity equations from the
challenge brief:

    Shipping delay   dT      = detour_days(route) * severity/10  + base queue
    Refinery run %   = max(0, 100 - beta * max(0, dT - SPR_buffer_days))
    Volume at risk           = chokepoint daily_oil_mbd * severity/10

The 9.5-day SPR buffer is taken straight from the problem statement. Price
impact is delegated to the trained model in services/price.py so the numbers
stay consistent across the app.
"""
from __future__ import annotations

from config import settings
from services import price as price_svc

SPR_BUFFER_DAYS = 9.5      # India strategic reserve buffer (per challenge brief)
BETA = 6.0                 # refinery run-rate sensitivity per day of shortfall
BASE_QUEUE_DAYS = 1.5      # congestion even at low severity
# When a chokepoint has NO viable maritime detour (detour_days == 0, e.g.
# Hormuz), a severe event means crude must be re-sourced from elsewhere — model
# that as a large effective lead-time, scaled by severity.
NO_DETOUR_RESOURCE_DAYS = 30.0

_chokepoints = {c["id"]: c for c in settings.load_config("chokepoints")["chokepoints"]}


def simulate(chokepoint_id: str, severity: int, current_brent: float | None = None) -> dict:
    severity = int(min(10, max(1, severity)))
    cp = _chokepoints.get(chokepoint_id)
    if cp is None:
        raise ValueError(f"unknown chokepoint '{chokepoint_id}'. "
                         f"Known: {list(_chokepoints)}")

    sev_frac = severity / 10.0
    # If a detour exists, the cost is the extra routing days; if none exists,
    # the cost is re-sourcing crude from a different supplier entirely.
    per_day_driver = cp["detour_days"] if cp["detour_days"] > 0 else NO_DETOUR_RESOURCE_DAYS
    delay_days = round(BASE_QUEUE_DAYS + per_day_driver * sev_frac, 1)
    shortfall = max(0.0, delay_days - SPR_BUFFER_DAYS)
    run_rate = max(0.0, 100.0 - BETA * shortfall)
    volume_at_risk = round(cp["daily_oil_mbd"] * sev_frac, 2)

    price = price_svc.forecast(severity, current_brent)

    # simple qualitative status for the dashboard
    if severity >= 8:
        status = "critical"
    elif severity >= 5:
        status = "elevated"
    else:
        status = "watch"

    return {
        "chokepoint": cp["id"],
        "chokepoint_name": cp["name"],
        "severity": severity,
        "status": status,
        "shipping_delay_days": delay_days,
        "spr_buffer_days": SPR_BUFFER_DAYS,
        "refinery_run_rate_pct": round(run_rate, 1),
        "oil_volume_at_risk_mbd": volume_at_risk,
        "detour_route_days": cp["detour_days"],
        "price_impact": price,
        "narrative": (
            f"A severity-{severity} event at {cp['name']} adds ~{delay_days} days "
            f"of transit. With only {SPR_BUFFER_DAYS} days of SPR buffer, refinery "
            f"run rate falls to ~{round(run_rate,1)}% and ~{volume_at_risk} mbd of "
            f"crude is exposed. Projected Brent: ${price['projected_brent_usd']} "
            f"(+{price['spike_pct']}%)."
        ),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(simulate("hormuz", 8), indent=2))
