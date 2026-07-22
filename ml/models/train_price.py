"""Train the Brent price-shock forecaster on real FRED data.

Two things are learned from history (no synthetic data):

1. A GradientBoosting regressor that predicts the *magnitude* of the next
   7-day Brent move from the current volatility/momentum regime. This is a
   real supervised time-series model with a time-ordered holdout.

2. An empirical severity->shock curve: the distribution of historical 7-day
   forward price spikes, bucketed so that a threat severity of `s` (1-10) maps
   to the s/10 quantile of real historical shocks. This grounds the agent's
   "what could prices do" answer in 38 years of actual Brent behaviour.

services/price.py loads both and combines them at inference.
"""
from __future__ import annotations

import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from config import settings

HORIZON = 7  # trading days ahead we forecast the shock over


def _features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("date").reset_index(drop=True).copy()
    df["ret"] = np.log(df["brent"]).diff()
    df["vol_30"] = df["ret"].rolling(30).std()
    df["mom_14"] = df["brent"].pct_change(14)
    df["roll_max_60"] = df["brent"].rolling(60).max()
    df["drawdown_60"] = df["brent"] / df["roll_max_60"] - 1.0
    # target: absolute log return over the next HORIZON days (shock magnitude)
    fwd = np.log(df["brent"].shift(-HORIZON)) - np.log(df["brent"])
    df["fwd_shock"] = fwd.abs()
    df["fwd_signed"] = fwd
    return df


def train() -> dict:
    raw = settings.DATA_RAW / "brent_prices.csv"
    if not raw.exists():
        raise SystemExit("Run `python -m data.fetch_fred` first.")
    df = pd.read_csv(raw, parse_dates=["date"])
    feats = _features(df).dropna(
        subset=["vol_30", "mom_14", "drawdown_60", "fwd_shock"]
    ).reset_index(drop=True)

    cols = ["vol_30", "mom_14", "drawdown_60"]
    X, y = feats[cols].values, feats["fwd_shock"].values

    # time-ordered split (no shuffling — this is a forecast)
    cut = int(len(X) * 0.8)
    X_tr, X_te, y_tr, y_te = X[:cut], X[cut:], y[:cut], y[cut:]

    model = GradientBoostingRegressor(
        n_estimators=300, max_depth=3, learning_rate=0.05, subsample=0.8,
        random_state=42,
    )
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    mae = mean_absolute_error(y_te, pred)
    r2 = r2_score(y_te, pred)
    print(f"[train_price] 7-day shock model — MAE {mae:.4f} log-ret, R2 {r2:.3f}")

    # empirical severity -> shock curve from the upside tail of real moves
    spikes = feats["fwd_signed"].clip(lower=0)  # only upward price spikes
    # quantiles 0.1..1.0 mapped to severity 1..10
    sev_to_shock = {
        s: float(np.quantile(spikes, q))
        for s, q in zip(range(1, 11), np.linspace(0.55, 0.999, 10))
    }
    # convert log-returns to % for readability
    sev_to_shock_pct = {s: float(np.expm1(v) * 100) for s, v in sev_to_shock.items()}

    baseline_vol = float(feats["vol_30"].tail(60).mean())
    last_price = float(df.sort_values("date")["brent"].iloc[-1])

    settings.ensure_dirs()
    joblib.dump(
        {
            "model": model,
            "feature_cols": cols,
            "horizon_days": HORIZON,
            "sev_to_shock_pct": sev_to_shock_pct,
            "baseline_vol_30": baseline_vol,
            "last_brent": last_price,
            "metrics": {"mae": mae, "r2": r2},
        },
        settings.PRICE_MODEL_PATH,
    )
    print(f"[train_price] severity->spike%% curve: "
          + ", ".join(f"{s}:{v:.1f}%" for s, v in sev_to_shock_pct.items()))
    print(f"[train_price] last Brent={last_price:.1f} USD, saved -> {settings.PRICE_MODEL_PATH}")
    return {"mae": mae, "r2": r2, "last_brent": last_price}


if __name__ == "__main__":
    train()
    sys.exit(0)
