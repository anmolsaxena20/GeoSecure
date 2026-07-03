"""Central paths + env config for the GeoSecure ML layer."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent          # ml/
CONFIG_DIR = ROOT / "config"
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "models" / "artifacts"

load_dotenv(ROOT / ".env")

ML_PORT = int(os.getenv("ML_PORT", "8001"))
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "").strip()
FRED_API_KEY = os.getenv("FRED_API_KEY", "").strip()
GDELT_MIN_INTERVAL = float(os.getenv("GDELT_MIN_INTERVAL", "5"))

# Artifact filenames
CLASSIFIER_PATH = ARTIFACTS / "threat_classifier.joblib"
PRICE_MODEL_PATH = ARTIFACTS / "price_shock.joblib"


def load_config(name: str) -> dict:
    """Load a JSON file from ml/config/ (e.g. 'chokepoints')."""
    with open(CONFIG_DIR / f"{name}.json", "r", encoding="utf-8") as fh:
        return json.load(fh)


def ensure_dirs() -> None:
    for d in (DATA_RAW, DATA_PROCESSED, ARTIFACTS):
        d.mkdir(parents=True, exist_ok=True)
