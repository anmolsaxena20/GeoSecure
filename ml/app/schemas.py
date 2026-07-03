"""Pydantic request/response models for the ML service."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ScoreTextRequest(BaseModel):
    text: str = Field(..., description="Raw news headline / article text")
    tone: float | None = Field(None, description="Optional GDELT tone signal")


class NewsItem(BaseModel):
    title: str = ""
    description: str = ""
    url: str = ""
    publishedAt: str = ""
    tone: float | None = None


class ScoreBatchRequest(BaseModel):
    items: list[NewsItem]


class ForecastRequest(BaseModel):
    severity: int = Field(..., ge=1, le=10)
    current_brent: float | None = Field(None, gt=0)


class DisruptionRequest(BaseModel):
    chokepoint: str = Field(..., description="Chokepoint id, e.g. 'hormuz'")
    severity: int = Field(..., ge=1, le=10)
    current_brent: float | None = Field(None, gt=0)


class OptimizeRequest(BaseModel):
    demand_kbd: float = Field(3000, gt=0, description="Required imports, kbbl/day")
    route_risk: dict[str, float] = Field(
        default_factory=dict,
        description="Map chokepoint id -> risk 0-10, e.g. {'hormuz': 9}",
    )
    compare: bool = Field(False, description="Also return baseline-vs-disrupted delta")


class AssessRequest(BaseModel):
    """End-to-end: news in, full risk + price + reroute recommendation out."""
    items: list[NewsItem] | None = None
    demand_kbd: float = Field(3000, gt=0)
    current_brent: float | None = None
