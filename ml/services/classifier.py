"""Inference wrapper for the news -> threat classifier.

Combines the trained TF-IDF/LogReg model (learned language signal) with the
lexicon severity score (interpretable, keyword-grounded) so the output is both
data-driven and explainable. Falls back to pure lexicon scoring if the model
artifact is missing, so the service never hard-fails.
"""
from __future__ import annotations

from functools import lru_cache

import joblib

from config import settings
from data.build_dataset import (
    clean_text,
    detect_event_type,
    detect_location,
    label_severity,
)

_BAND_MID = {"low": 2.0, "medium": 5.0, "high": 8.0}


@lru_cache(maxsize=1)
def _load():
    if settings.CLASSIFIER_PATH.exists():
        return joblib.load(settings.CLASSIFIER_PATH)
    return None


def score_text(text: str, tone: float | None = None) -> dict:
    bundle = _load()
    clean = clean_text(text)
    location = detect_location(text)
    event_type = detect_event_type(text)
    lex_sev = label_severity(text, tone)

    band, confidence, model_used = None, None, False
    if bundle is not None and clean:
        pipe = bundle["pipeline"]
        band = str(pipe.predict([clean])[0])
        try:
            proba = pipe.predict_proba([clean])[0]
            confidence = float(max(proba))
        except Exception:  # noqa: BLE001
            confidence = None
        model_used = True

    if band is not None:
        # blend learned band midpoint with lexicon score
        severity = round(0.5 * _BAND_MID[band] + 0.5 * lex_sev)
    else:
        severity = lex_sev
        band = "low" if severity <= 3 else "medium" if severity <= 6 else "high"

    severity = int(min(10, max(1, severity)))
    return {
        "text": text[:280],
        "location": location,
        "event_type": event_type,
        "threat_detected": severity >= 4,
        "severity": severity,
        "risk_band": band,
        "confidence": round(confidence, 3) if confidence is not None else None,
        "model_used": model_used,
    }


def score_batch(items: list[dict]) -> list[dict]:
    """items: [{'title':..., 'description':..., 'tone':...}] -> scored list."""
    out = []
    for it in items:
        text = " ".join(filter(None, [it.get("title", ""), it.get("description", "")]))
        scored = score_text(text, it.get("tone"))
        scored["url"] = it.get("url", "")
        scored["publishedAt"] = it.get("publishedAt", "")
        out.append(scored)
    return out
