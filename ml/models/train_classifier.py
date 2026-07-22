"""Train the news -> threat-severity classifier.

Pipeline: TF-IDF (word + char n-grams) -> Logistic Regression, predicting the
3-class risk band (low/medium/high) from article text. We also fit a light
regressor head implicitly by mapping the predicted band + keyword score to a
1-10 severity at inference (see services/classifier.py).

Trained on the weakly-labelled GDELT corpus from data/build_dataset.py.
"""
from __future__ import annotations

import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

from config import settings
from data import build_dataset


def _build_pipeline() -> Pipeline:
    # word n-grams capture phrases; char n-grams capture morphology / typos /
    # short-title sparsity — important because GDELT titles are short.
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True,
                                 min_df=1, max_features=20000, stop_words="english")),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5),
                                 sublinear_tf=True, min_df=1, max_features=30000)),
    ])
    return Pipeline([
        ("feats", features),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=4.0)),
    ])


def _load_training_frame() -> pd.DataFrame:
    proc = settings.DATA_PROCESSED / "training_data.csv"
    if proc.exists():
        return pd.read_csv(proc)
    # build on the fly if the processed file isn't there yet
    return build_dataset.build()


def train() -> dict:
    df = _load_training_frame()
    df = df.dropna(subset=["clean", "risk_band"])
    if len(df) < 30:
        raise SystemExit(
            f"Only {len(df)} labelled rows — run `python -m data.fetch_gdelt` "
            "then `python -m data.build_dataset` to gather more first."
        )

    X = df["clean"].astype(str)
    y = df["risk_band"].astype(str)

    strat = y if y.value_counts().min() >= 2 else None
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=strat
    )

    pipe = _build_pipeline()
    pipe.fit(X_tr, y_tr)

    pred = pipe.predict(X_te)
    acc = float(accuracy_score(y_te, pred))
    # binary threat metric: high|medium == "threat", low == "no threat".
    # This is what `threat_detected` keys off and is the headline number.
    to_bin = lambda s: (s != "low").astype(int)
    bin_acc = float(accuracy_score(to_bin(y_te), to_bin(pd.Series(pred))))
    print(f"[train_classifier] 3-class holdout accuracy: {acc:.3f}")
    print(f"[train_classifier] binary threat-detection accuracy: {bin_acc:.3f}")
    print(classification_report(y_te, pred, zero_division=0))

    # refit on ALL data before saving (more signal for the deployed model)
    pipe.fit(X, y)
    settings.ensure_dirs()
    joblib.dump(
        {"pipeline": pipe, "classes": list(pipe.named_steps["clf"].classes_)},
        settings.CLASSIFIER_PATH,
    )
    print(f"[train_classifier] saved -> {settings.CLASSIFIER_PATH}")
    return {"accuracy": acc, "n_train": len(df)}


if __name__ == "__main__":
    train()
    sys.exit(0)
