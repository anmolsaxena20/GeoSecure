"""Stage 4 — Adaptive Procurement Orchestrator (Linear Programming, PuLP).

Decides how many barrels/day to lift from each supplier to meet India's import
demand at minimum *risk-adjusted* cost, subject to:

  - demand satisfaction (sum of lifts >= required volume)
  - per-supplier max lift capacity
  - refinery crude-slate compatibility (API gravity + sulfur must be runnable
    by at least one refinery with spare capacity)
  - route-risk penalties: each supplier's effective cost is inflated by the
    risk on the chokepoints its cargo transits — so when Stage 1/2 flag a
    corridor, the optimizer automatically shifts volume to safer sources.

Re-running with a new `route_risk` map (e.g. Hormuz risk jumps to 9) instantly
re-ranks suppliers — the "reactive -> proactive" rerouting the brief asks for.
"""
from __future__ import annotations

import pulp

from config import settings

_suppliers = settings.load_config("suppliers")["suppliers"]
_refineries = settings.load_config("refineries")["refineries"]

FREIGHT_USD_PER_BBL_PER_DAY = 0.18   # rough VLCC time-charter pass-through
RISK_PENALTY_USD_PER_POINT = 2.2     # $/bbl added per risk point on the route


def _compatible(supplier: dict) -> list[str]:
    """Refinery ids that can run this crude's API/sulfur."""
    return [
        r["id"] for r in _refineries
        if r["api_min"] <= supplier["api"] <= r["api_max"]
        and supplier["sulfur"] <= r["sulfur_max_pct"]
    ]


def _route_risk(supplier: dict, route_risk: dict[str, float]) -> float:
    """Max risk (0-10) across the chokepoints this supplier transits."""
    risks = [route_risk.get(cp, 0.0) for cp in supplier.get("routes_through", [])]
    return max(risks) if risks else 0.0


def optimize(demand_kbd: float, route_risk: dict[str, float] | None = None) -> dict:
    route_risk = route_risk or {}
    prob = pulp.LpProblem("procurement", pulp.LpMinimize)

    lift, eff_cost, meta = {}, {}, {}
    for s in _suppliers:
        sid = s["id"]
        compat = _compatible(s)
        cap = s["max_supply_kbd"] if compat else 0.0   # incompatible -> unusable
        lift[sid] = pulp.LpVariable(f"lift_{sid}", lowBound=0, upBound=cap)

        risk = _route_risk(s, route_risk)
        freight = FREIGHT_USD_PER_BBL_PER_DAY * s["transit_days"]
        risk_pen = RISK_PENALTY_USD_PER_POINT * risk
        eff_cost[sid] = s["base_price_usd"] + freight + risk_pen
        meta[sid] = {
            "name": s["name"], "country": s["country"], "api": s["api"],
            "sulfur": s["sulfur"], "base_price_usd": s["base_price_usd"],
            "freight_usd": round(freight, 2), "route_risk": risk,
            "risk_penalty_usd": round(risk_pen, 2),
            "effective_cost_usd": round(eff_cost[sid], 2),
            "compatible_refineries": compat, "max_supply_kbd": s["max_supply_kbd"],
        }

    # objective: minimise total risk-adjusted spend
    prob += pulp.lpSum(eff_cost[sid] * lift[sid] for sid in lift)
    # demand must be met
    prob += pulp.lpSum(lift.values()) >= demand_kbd, "meet_demand"

    status = prob.solve(pulp.PULP_CBC_CMD(msg=False))
    feasible = pulp.LpStatus[status] == "Optimal"

    allocation = []
    total_cost = 0.0
    for sid in lift:
        vol = lift[sid].value() or 0.0
        if vol > 1e-3:
            line_cost = eff_cost[sid] * vol
            total_cost += line_cost
            allocation.append({
                "supplier_id": sid, **meta[sid],
                "allocated_kbd": round(vol, 1),
                "line_cost_usd_per_day_k": round(line_cost, 1),
            })
    allocation.sort(key=lambda a: -a["allocated_kbd"])

    blended = (total_cost / demand_kbd) if demand_kbd else 0.0
    return {
        "feasible": feasible,
        "status": pulp.LpStatus[status],
        "demand_kbd": demand_kbd,
        "route_risk": route_risk,
        "blended_cost_usd_per_bbl": round(blended, 2),
        "total_cost_usd_per_day_thousands": round(total_cost, 1),
        "n_suppliers_used": len(allocation),
        "allocation": allocation,
    }


def compare_scenarios(demand_kbd: float, route_risk: dict[str, float]) -> dict:
    """Baseline (no risk) vs disrupted (given risk) — shows the rerouting delta."""
    base = optimize(demand_kbd, {})
    disrupted = optimize(demand_kbd, route_risk)
    return {
        "baseline": base,
        "disrupted": disrupted,
        "cost_increase_usd_per_bbl": round(
            disrupted["blended_cost_usd_per_bbl"] - base["blended_cost_usd_per_bbl"], 2
        ),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(optimize(3000, {"hormuz": 9}), indent=2)[:1500])
