"""Clean the GDELT corpus and assign weak-supervision severity labels.

We have no hand-labelled severity data (none exists for a hackathon), so we use
*label functions* (weak supervision): cheap heuristics that vote on a 1-10
threat severity. A model trained on these labels generalises beyond the exact
keywords — it learns the surrounding language — which is the whole point of
training rather than just keyword-matching at inference.
"""
from __future__ import annotations

import re
import sys

import numpy as np
import pandas as pd

from config import settings

# --- severity lexicon: keyword -> threat weight (higher = more disruptive) ----
THREAT_TERMS = {
    # catastrophic
    "closure": 5, "blockade": 5, "shut": 4, "seized": 4, "seize": 4,
    "missile": 4, "strike": 4, "attack": 4, "war": 4, "invasion": 5,
    # serious
    "drone": 3, "explosion": 3, "sabotage": 3, "mine": 3, "hijack": 3,
    "sanction": 3, "embargo": 3, "halt": 3, "suspend": 3, "blast": 3,
    # elevated
    "tension": 2, "threat": 2, "warning": 2, "reroute": 2, "delay": 2,
    "disruption": 2, "conflict": 2, "clash": 2, "protest": 2, "outage": 2,
    # mild / de-escalation (negative weight)
    "resume": -2, "reopen": -2, "ceasefire": -3, "deal": -1, "ease": -2,
    "stabil": -2, "normal": -2, "recover": -1,
}

EVENT_TYPES = {
    "military_strike": ["strike", "missile", "attack", "drone", "bomb", "shelling"],
    "blockade_closure": ["blockade", "closure", "closed", "shut", "block"],
    "vessel_seizure": ["seized", "seize", "hijack", "boarded", "detained"],
    "sanction": ["sanction", "embargo", "ban", "tariff"],
    "sabotage": ["sabotage", "explosion", "blast", "mine", "fire"],
    "unrest": ["protest", "strike action", "clash", "riot", "coup"],
    "de_escalation": ["ceasefire", "resume", "reopen", "deal", "agreement"],
}

_chokepoints = settings.load_config("chokepoints")["chokepoints"]

# Curated seed headlines so the classifier sees every chokepoint and event type
# with good language diversity even when the live GDELT sweep is thin / rate-
# limited. Labels are still assigned by the weak-supervision label functions
# below (not hand-set), so the seeds and the real corpus are labelled the same
# way — the seeds only guarantee coverage.
SEED_HEADLINES = [
    # high severity — strikes / closures / seizures
    "Missile strike closes the Strait of Hormuz to oil tankers amid Iran standoff",
    "Iran threatens to blockade the Strait of Hormuz as Gulf tensions escalate",
    "Houthi drone attack hits crude tanker in the Red Sea, vessel ablaze",
    "Bab-el-Mandeb shipping halted after missile barrage near Yemen coast",
    "Tanker seized by armed forces in the Persian Gulf, crew detained",
    "Suez Canal blocked after vessel runs aground, hundreds of ships queue",
    "Explosion at major oil pipeline forces refinery shutdown",
    "Naval clash near Strait of Malacca disrupts crude shipments to Asia",
    "Sabotage suspected as fire engulfs Gulf export terminal",
    "War risk premiums spike as conflict spreads to Red Sea shipping lanes",
    "Sanctions ban all Russian crude exports, Urals cargoes stranded",
    "Drone swarm strikes Saudi oil facility, output slashed overnight",
    # medium severity — tension / warnings / partial disruption
    "Rising tensions in the Persian Gulf prompt tanker insurers to raise rates",
    "Shipping firms reroute around Cape of Good Hope to avoid Red Sea risk",
    "OPEC warns of supply tightness as Middle East unrest grows",
    "Iran oil exports face new restrictions amid nuclear dispute",
    "Suez Canal traffic slows as security threat warnings issued",
    "Crude prices climb on fears of disruption near Bab-el-Mandeb",
    "Malacca Strait congestion delays oil shipments by several days",
    "Protests near port threaten to disrupt crude loading schedules",
    "Red Sea attacks push freight costs higher for Asian refiners",
    "Gulf tension raises concerns over Hormuz transit reliability",
    # low severity / de-escalation / benign
    "Refinery resumes normal run rate after scheduled maintenance",
    "Ceasefire agreement eases tensions, shipping returns to Red Sea routes",
    "Suez Canal reopens to full traffic after brief suspension",
    "OPEC holds output steady, markets stable",
    "Brent crude edges lower on calm geopolitical outlook",
    "New trade deal boosts crude flows between Gulf and Asia",
    "Tanker traffic through Hormuz returns to normal levels",
    "Oil prices stabilise as supply concerns recover",
    "Mangalore refinery completes upgrade, raises processing capacity",
    "Shipping rates ease as Red Sea security situation improves",
    # --- expansion: more HIGH severity, varied phrasing & locations ---
    "Iran seizes oil tanker in Strait of Hormuz, raising shipping costs",
    "Ballistic missiles target commercial vessels off Yemen in the Red Sea",
    "Suez Canal authority suspends transit after attack on cargo ship",
    "Saudi Aramco terminal ablaze following coordinated drone assault",
    "US imposes sweeping sanctions halting Iranian crude shipments",
    "Pirates hijack VLCC near Bab-el-Mandeb, hold crew hostage",
    "Explosion rocks Gulf pipeline, cutting export flows sharply",
    "Naval blockade chokes off oil exports through the Persian Gulf",
    "Mine strike damages tanker hull in the Strait of Malacca",
    "Air strikes hit port infrastructure, halting crude loadings",
    "Houthi forces vow to close Bab-el-Mandeb to Western tankers",
    "Conflict escalation triggers war-risk insurance surge across Red Sea lanes",
    "Tanker set ablaze by missile near Hormuz, salvage crews scramble",
    "Sabotage of undersea pipeline disrupts regional crude supply",
    # --- expansion: more MEDIUM severity ---
    "Insurers hike premiums as Gulf tensions cloud tanker schedules",
    "Asian refiners brace for delays as Red Sea reroutes lengthen voyages",
    "Suez backlog grows amid heightened security alerts",
    "Brent rises on worries over possible Hormuz disruption",
    "Diplomatic standoff threatens to curb Iranian oil flows",
    "Shipping advisories warn of elevated risk near Bab-el-Mandeb",
    "Crude freight rates jump as vessels avoid the southern Red Sea",
    "Port workers' strike threatens to slow Gulf crude exports",
    "Tensions simmer in Malacca Strait after naval standoff",
    "Sanctions uncertainty weighs on Russian Urals cargo bookings",
    # --- expansion: more LOW / benign / recovery ---
    "Crude trade flows normalise as Red Sea transits resume",
    "Hormuz tanker traffic steady, no disruptions reported",
    "OPEC+ extends current output policy, prices little changed",
    "Calm returns to Gulf shipping lanes after diplomatic talks",
    "Refinery maintenance season proceeds smoothly, supply ample",
    "Brent slips as geopolitical risk premium fades",
    "Suez Canal sees record throughput amid stable conditions",
    "India diversifies crude imports, easing supply concerns",
    "Freight rates soften as security situation stabilises",
    "Markets shrug off minor Gulf incident, oil flat",
]


def is_english(text: str, min_ascii_ratio: float = 0.9) -> bool:
    """Heuristic English filter: keep titles that are almost entirely ASCII.

    A safety net behind the GDELT `sourcelang:english` query — drops any
    non-English titles that still slip through, since the classifier and the
    LLM labeller are English-only.
    """
    s = str(text).strip()
    if not s:
        return False
    ascii_chars = sum(1 for c in s if ord(c) < 128)
    return (ascii_chars / len(s)) >= min_ascii_ratio


def clean_text(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"http\S+", " ", text)
    text = re.sub(r"[^a-z0-9\s\-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_location(text: str) -> str:
    """Return the chokepoint id whose keywords appear, else 'unknown'."""
    t = (text or "").lower()
    for cp in _chokepoints:
        if any(kw in t for kw in cp["keywords"]):
            return cp["id"]
    return "unknown"


def detect_event_type(text: str) -> str:
    t = (text or "").lower()
    for etype, kws in EVENT_TYPES.items():
        if any(kw in t for kw in kws):
            return etype
    return "general"


def label_severity(text: str, tone: float | None = None) -> int:
    """Weak-supervision severity in [1, 10]."""
    t = clean_text(text)
    score = 0
    for term, w in THREAT_TERMS.items():
        if term in t:
            score += w
    # chokepoint mention adds baseline risk, weighted by oil throughput
    loc = detect_location(text)
    if loc != "unknown":
        cp = next(c for c in _chokepoints if c["id"] == loc)
        score += 1 + cp["daily_oil_mbd"] / 10.0
    # GDELT tone: negative tone amplifies threat
    if tone is not None and not np.isnan(tone):
        score += max(0.0, -tone) / 3.0
    # squash to 1..10
    sev = int(round(np.clip(1 + score, 1, 10)))
    return sev


def build(raw_csv: str | None = None) -> pd.DataFrame:
    path = raw_csv or (settings.DATA_RAW / "gdelt_corpus.csv")
    frames = []
    if path.exists():
        g = pd.read_csv(path)
        g["source"] = "gdelt"
        frames.append(g[[c for c in ["title", "tone", "source"] if c in g.columns]])
    # always fold in the curated seed headlines for coverage + diversity
    seed = pd.DataFrame({"title": SEED_HEADLINES})
    seed["tone"] = float("nan")
    seed["source"] = "seed"
    frames.append(seed)

    df = pd.concat(frames, ignore_index=True)
    df["title"] = df["title"].astype(str)
    df["tone"] = pd.to_numeric(df.get("tone"), errors="coerce")
    df = df.drop_duplicates(subset=["title"]).reset_index(drop=True)
    # English-only safety net (behind the GDELT sourcelang:english query)
    before = len(df)
    df = df[df["title"].map(is_english)].reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        print(f"[build_dataset] dropped {dropped} non-English titles")
    df["clean"] = df["title"].map(clean_text)
    df = df[df["clean"].str.len() >= 8].copy()
    df["location"] = df["title"].map(detect_location)
    df["event_type"] = df["title"].map(detect_event_type)
    df["severity"] = [
        label_severity(t, tone) for t, tone in zip(df["title"], df["tone"])
    ]
    # 3-class bucket for a more stable classifier target
    df["risk_band"] = pd.cut(
        df["severity"], bins=[0, 3, 6, 10], labels=["low", "medium", "high"]
    )
    return df.reset_index(drop=True)


def main() -> None:
    settings.ensure_dirs()
    df = build()
    out = settings.DATA_PROCESSED / "training_data.csv"
    df.to_csv(out, index=False)
    print(f"[build_dataset] {len(df)} labelled rows -> {out}")
    print(df["risk_band"].value_counts().to_string())
    print("severity distribution:")
    print(df["severity"].value_counts().sort_index().to_string())


if __name__ == "__main__":
    sys.exit(main())
