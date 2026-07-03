"""Smoke + logic tests for the ML services. Run: python -m pytest ml/tests -q
(or plain `python -m tests.test_services` for a no-pytest check)."""
from __future__ import annotations

from services import disruption, geo, optimizer
from services import price as price_svc
from services import classifier


def test_classifier_high_threat():
    out = classifier.score_text("Missile strike closes the Strait of Hormuz to oil tankers")
    assert out["location"] == "hormuz"
    assert out["severity"] >= 6
    assert out["threat_detected"] is True


def test_classifier_benign():
    out = classifier.score_text("Refinery resumes normal operations after maintenance")
    assert out["severity"] <= 5


def test_price_monotonic():
    f2 = price_svc.forecast(2)
    f9 = price_svc.forecast(9)
    assert f9["projected_brent_usd"] >= f2["projected_brent_usd"]


def test_price_path_widens_and_reaches_target():
    p = price_svc.forecast_path(9, current_brent=80.0)
    path = p["path"]
    assert path[0]["price"] == 80.0                      # starts at today's price
    assert path[0]["lower"] == path[0]["upper"]          # zero uncertainty at t0
    # band widens monotonically with horizon
    widths = [pt["upper"] - pt["lower"] for pt in path]
    assert widths == sorted(widths)
    # central path ends at the single-point projected spike
    assert abs(path[-1]["price"] - p["endpoint_forecast"]["projected_brent_usd"]) < 0.05


def test_disruption_spr_logic():
    sim = disruption.simulate("bab_el_mandeb", 9)
    assert sim["shipping_delay_days"] > 0
    assert 0 <= sim["refinery_run_rate_pct"] <= 100


def test_optimizer_meets_demand():
    res = optimizer.optimize(3000, {})
    assert res["feasible"]
    assert sum(a["allocated_kbd"] for a in res["allocation"]) >= 3000 - 1


def test_optimizer_reroutes_under_risk():
    """High Hormuz risk should reduce reliance on Hormuz-routed suppliers."""
    base = optimizer.optimize(3000, {})
    risky = optimizer.optimize(3000, {"hormuz": 10})
    hormuz_ids = {"iraq_basrah", "saudi_arab_light", "uae_murban"}
    base_h = sum(a["allocated_kbd"] for a in base["allocation"] if a["supplier_id"] in hormuz_ids)
    risk_h = sum(a["allocated_kbd"] for a in risky["allocation"] if a["supplier_id"] in hormuz_ids)
    assert risk_h <= base_h
    assert risky["blended_cost_usd_per_bbl"] >= base["blended_cost_usd_per_bbl"]


def test_geo_alert():
    layer = geo.risk_layer([
        {"location": "hormuz", "severity": 9, "text": "strike"},
    ])
    assert "hormuz" in layer["active_alerts"]


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"PASS {name}")
    print("all checks passed")
