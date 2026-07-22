"""GeoSecure ML service — FastAPI.

Exposes the four ML stages as HTTP endpoints the Node `ai/` agents and the
backend call, plus an /assess endpoint that runs the whole pipeline:
news -> threat scores -> geo risk -> disruption sim -> procurement reroute.

Run:  uvicorn app.main:app --reload --port 8001
Docs: http://localhost:8001/docs
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    AssessRequest,
    DisruptionRequest,
    ForecastRequest,
    OptimizeRequest,
    ScoreBatchRequest,
    ScoreTextRequest,
)
from config import settings
from data import fetch_news
from services import classifier, disruption, geo, market, optimizer
from services import price as price_svc

app = FastAPI(
    title="GeoSecure ML Service",
    version="1.0",
    description="Geopolitical supply-chain risk ML: threat scoring, price-shock "
                "forecasting, disruption simulation, procurement optimization.",
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "service": "GeoSecure ML",
        "docs": "/docs",
        "health": "/health",
        "endpoints": [
            "POST /score-news", "POST /score-news/batch", "GET /score-news/live",
            "POST /simulate-disruption", "POST /forecast-price",
            "POST /forecast-price/path", "GET /market/brent",
            "POST /optimize-procurement", "POST /assess",
        ],
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "classifier_loaded": settings.CLASSIFIER_PATH.exists(),
        "price_model_loaded": settings.PRICE_MODEL_PATH.exists(),
        "newsapi_configured": bool(settings.NEWSAPI_KEY),
    }


# ---- Stage 1: news threat scoring ------------------------------------------
@app.post("/score-news")
def score_news(req: ScoreTextRequest) -> dict:
    return classifier.score_text(req.text, req.tone)


@app.post("/score-news/batch")
def score_news_batch(req: ScoreBatchRequest) -> dict:
    items = [i.model_dump() for i in req.items]
    scored = classifier.score_batch(items)
    return {"count": len(scored), "results": scored}


@app.get("/score-news/live")
def score_news_live() -> dict:
    """Pull live (or sample) headlines, score them, and build the geo layer."""
    raw = fetch_news.fetch_live()
    scored = classifier.score_batch(raw)
    return {
        "source": "newsapi" if settings.NEWSAPI_KEY else "sample",
        "count": len(scored),
        "results": scored,
        "geo": geo.risk_layer(scored),
    }


# ---- Stage 2: disruption simulation ----------------------------------------
@app.post("/simulate-disruption")
def simulate_disruption(req: DisruptionRequest) -> dict:
    try:
        return disruption.simulate(req.chokepoint, req.severity, req.current_brent)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ---- price-shock forecast (used by Stage 2 and directly) -------------------
@app.post("/forecast-price")
def forecast_price(req: ForecastRequest) -> dict:
    return price_svc.forecast(req.severity, req.current_brent)


@app.post("/forecast-price/path")
def forecast_price_path(req: ForecastRequest) -> dict:
    """7-day forward Brent trajectory with an uncertainty band (time series)."""
    return price_svc.forecast_path(req.severity, req.current_brent)


@app.get("/market/brent")
def market_brent() -> dict:
    """Latest Brent price, pulled live from FRED (keyless), cached ~1h."""
    return market.get_latest_brent()


# ---- Stage 4: procurement optimization -------------------------------------
@app.post("/optimize-procurement")
def optimize_procurement(req: OptimizeRequest) -> dict:
    if req.compare:
        return optimizer.compare_scenarios(req.demand_kbd, req.route_risk)
    return optimizer.optimize(req.demand_kbd, req.route_risk)


# ---- End-to-end orchestration ----------------------------------------------
@app.post("/assess")
def assess(req: AssessRequest) -> dict:
    """Full pipeline: news -> scores -> geo -> worst chokepoint sim -> reroute."""
    raw = [i.model_dump() for i in req.items] if req.items else fetch_news.fetch_live()
    scored = classifier.score_batch(raw)
    layer = geo.risk_layer(scored)

    # pick the highest-risk chokepoint as the scenario driver
    ranked = sorted(layer["chokepoints"], key=lambda c: -c["risk"])
    worst = ranked[0] if ranked and ranked[0]["risk"] > 0 else None

    sim = reroute = None
    if worst:
        sev = int(round(worst["risk"]))
        sim = disruption.simulate(worst["id"], sev, req.current_brent)
        route_risk = {c["id"]: c["risk"] for c in layer["chokepoints"] if c["risk"] > 0}
        reroute = optimizer.compare_scenarios(req.demand_kbd, route_risk)

    return {
        "threat_scores": scored,
        "geo": layer,
        "scenario": sim,
        "procurement": reroute,
        "summary": _summary(worst, sim, reroute),
    }


def _summary(worst, sim, reroute) -> str:
    if not worst:
        return "No significant supply-chain threats detected in the current feed."
    line = (f"Highest risk at {worst['name']} (risk {worst['risk']}/10). "
            f"{sim['narrative']}")
    if reroute:
        line += (f" Recommended reroute raises blended crude cost by "
                 f"${reroute['cost_increase_usd_per_bbl']}/bbl but secures supply.")
    return line


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.ML_PORT, reload=False)
