# GeoSecure — ML Layer

The quantitative brain of GeoSecure (Project 2: *AI-Driven Energy Supply Chain
Resilience*). It turns geopolitical news into structured risk, simulates the
economic ripple effects, and emits a concrete procurement-rerouting
recommendation. The Node `ai/` agents and `backend/` call it over HTTP.

> Scope split: the `ai/` folder owns the **LLM agent reasoning**. This `ml/`
> folder owns the **trained models + optimization** the agents call. No
> overlap, no rewrites to the other folders.

## The four stages

| Stage | What | Technique | Endpoint |
|------|------|-----------|----------|
| 1 | News → threat severity (1-10), location, event type | TF-IDF (word + char n-grams) + Logistic Regression on a weakly-labelled ~570-article English-only GDELT corpus; blended with a keyword lexicon. **3-class accuracy ~0.74, binary threat-detection ~0.89** | `POST /score-news` |
| 2 | Severity → shipping delay, refinery run-rate, volume at risk | Calibrated sensitivity equations (9.5-day SPR buffer from brief) | `POST /simulate-disruption` |
| — | Severity → Brent price spike + India import-bill impact | GradientBoosting on 38 yrs of real FRED Brent prices + empirical shock curve | `POST /forecast-price` |
| — | 7-day forward Brent **trajectory** with uncertainty band | Same model, diffusion-style band (σ·√t) off live price | `POST /forecast-price/path` |
| — | Latest Brent price, live | Keyless FRED pull, cached ~1h | `GET /market/brent` |
| 3 | Per-chokepoint risk layer for the map | Aggregation over scored news, bbox/colour tints | `GET /score-news/live` (`.geo`) |
| 4 | Optimal crude sourcing under route risk | Linear Programming (PuLP), refinery-compatibility + risk-penalty constraints | `POST /optimize-procurement` |
| ★ | **End-to-end**: news → scores → geo → worst-case sim → reroute | orchestrates all of the above | `POST /assess` |

## Data sources (all free)

- **FRED** `DCOILBRENTEU` — daily Brent crude prices, 1987→today (keyless CSV endpoint).
- **GDELT 2.0 Doc API** — geopolitical/maritime news corpus for training labels (keyless, rate-limited 1 req/5s).
- **NewsAPI** — live demo feed only (`NEWSAPI_KEY` optional; falls back to bundled sample headlines).

## Live vs. static (what updates when)

- **Brent price** is pulled **live** from FRED at request time (cached ~1h) via
  `GET /market/brent`; `/forecast-price*` and `/simulate-disruption` use it
  automatically unless you pass `current_brent`. Falls back to the model's
  baked-in snapshot if offline.
- **News scoring** is live per request — throw any headline at `/score-news`.
  `/score-news/live` *pulls* fresh headlines (NewsAPI if keyed, else samples).
- **Trained models** (classifier, price-shock) are static artifacts — retrain by
  re-running the build steps below when you want fresher learned behaviour.

## Setup

```bash
cd ml
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env                                 # optional: add NEWSAPI_KEY
```

## Build data + train (one-time)

```bash
python -m data.fetch_fred          # -> data/raw/brent_prices.csv
python -m data.fetch_gdelt         # -> data/raw/gdelt_corpus.csv  (~2 min, throttled)
python -m data.build_dataset       # -> data/processed/training_data.csv (weak labels)
python -m models.train_classifier  # -> models/artifacts/threat_classifier.joblib
python -m models.train_price       # -> models/artifacts/price_shock.joblib
```

Or run the whole thing: `python pipeline.py`

## Serve

```bash
uvicorn app.main:app --reload --port 8001
# Swagger docs: http://localhost:8001/docs
```

## Example

```bash
curl -X POST localhost:8001/score-news \
  -H "Content-Type: application/json" \
  -d '{"text":"Missile strike closes Strait of Hormuz to oil tankers"}'

curl -X POST localhost:8001/optimize-procurement \
  -H "Content-Type: application/json" \
  -d '{"demand_kbd":3000,"route_risk":{"hormuz":9},"compare":true}'
```

## Tests

```bash
python -m pytest tests -q          # or: python -m tests.test_services
```

## Layout

```
ml/
  config/        domain knowledge (chokepoints, refineries, suppliers) + settings
  data/          fetchers (FRED/GDELT/NewsAPI) + cleaning/weak-labelling
  models/        training scripts; artifacts/ holds the .joblib models
  services/      inference: classifier, price, disruption, optimizer, geo
  app/           FastAPI service (main.py) + pydantic schemas
  tests/         smoke + logic tests
  pipeline.py    one-command data->train build
```
