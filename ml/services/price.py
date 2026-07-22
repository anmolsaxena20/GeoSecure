"""Inference wrapper for the Brent price-shock forecaster.

Given a threat severity (and optionally a current Brent price), return the
projected price spike and a first-order pass-through to India's import bill.
"""
from __future__ import annotations

import math
from functools import lru_cache

import joblib

from config import settings
from services import market

# India crude import scale (order-of-magnitude, public figures):
# ~4.6 billion barrels/year imported. Used for import-bill sensitivity only.
INDIA_IMPORT_BBL_PER_YEAR = 4.6e9


@lru_cache(maxsize=1)
def _load():
    if settings.PRICE_MODEL_PATH.exists():
        return joblib.load(settings.PRICE_MODEL_PATH)
    return None


def _resolve_base(current_brent: float | None, bundle: dict | None) -> tuple[float, str]:
    """Pick the baseline Brent price: caller-supplied > live FRED > trained snapshot."""
    if current_brent is not None:
        return current_brent, "user"
    live = market.get_latest_brent()
    if live["brent"] is not None:
        return live["brent"], f"fred_live({live['as_of']})"
    if bundle is not None:
        return bundle["last_brent"], "model_snapshot"
    return 80.0, "default"


def forecast(severity: int, current_brent: float | None = None) -> dict:
    severity = int(min(10, max(1, severity)))
    bundle = _load()
    base, base_src = _resolve_base(current_brent, bundle)

    if bundle is None:
        spike_pct = 3.0 * severity  # heuristic fallback
        out = _assemble(severity, base, spike_pct, model_used=False, horizon=7, r2=None)
    else:
        spike_pct = bundle["sev_to_shock_pct"][severity]
        out = _assemble(severity, base, spike_pct, model_used=True,
                        horizon=bundle["horizon_days"], r2=bundle["metrics"]["r2"])
    out["price_source"] = base_src
    return out


def forecast_path(severity: int, current_brent: float | None = None) -> dict:
    """Return a day-by-day Brent trajectory to the horizon with an uncertainty band.

    Central path interpolates from today's price to the projected spike. The band
    widens as sqrt(t) using the model's historical daily volatility (a standard
    diffusion-style confidence interval), so it honestly shows growing uncertainty.
    """
    base_pt = forecast(severity, current_brent)
    bundle = _load()
    horizon = base_pt["horizon_days"]
    target = base_pt["projected_brent_usd"]
    base = base_pt["current_brent_usd"]
    daily_vol = bundle["baseline_vol_30"] if bundle else 0.02
    z = 1.28  # ~80% interval

    path = []
    for day in range(horizon + 1):
        frac = day / horizon
        mid = base * (1 - frac) + target * frac     # linear glide to the spike
        spread = z * daily_vol * math.sqrt(day)     # widens with horizon
        path.append({
            "day": day,
            "price": round(mid, 2),
            "lower": round(mid * math.exp(-spread), 2),
            "upper": round(mid * math.exp(spread), 2),
        })
    return {
        "severity": base_pt["severity"],
        "horizon_days": horizon,
        "price_source": base_pt["price_source"],
        "model_used": base_pt["model_used"],
        "endpoint_forecast": base_pt,
        "path": path,
    }


def _assemble(severity, base, spike_pct, model_used, horizon, r2) -> dict:
    projected = base * (1 + spike_pct / 100.0)
    delta_usd = projected - base
    extra_import_bill_usd_yr = delta_usd * INDIA_IMPORT_BBL_PER_YEAR
    return {
        "severity": severity,
        "current_brent_usd": round(base, 2),
        "projected_brent_usd": round(projected, 2),
        "spike_pct": round(spike_pct, 2),
        "horizon_days": horizon,
        "india_extra_import_bill_usd_per_year": round(extra_import_bill_usd_yr, 0),
        "india_extra_import_bill_bn_usd_per_year": round(extra_import_bill_usd_yr / 1e9, 2),
        "model_used": model_used,
        "model_r2": round(r2, 3) if r2 is not None else None,
    }


if __name__ == "__main__":
    for s in (2, 5, 8, 10):
        f = forecast(s)
        print(f"sev {s}: Brent {f['current_brent_usd']} -> {f['projected_brent_usd']} "
              f"(+{f['spike_pct']}%), +${f['india_extra_import_bill_bn_usd_per_year']}bn/yr")
