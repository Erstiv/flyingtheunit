from pydantic import BaseModel
from datetime import datetime


class PlatformCount(BaseModel):
    platform: str
    count: int


class SentimentBreakdown(BaseModel):
    positive: int = 0
    negative: int = 0
    neutral: int = 0
    mixed: int = 0


class VolumePoint(BaseModel):
    hour: datetime
    count: int
    avg_sentiment: float | None = None


class DashboardOverview(BaseModel):
    total_posts: int = 0
    total_entities: int = 0
    active_topics: int = 0
    posts_24h: int = 0
    sentiment_breakdown: SentimentBreakdown = SentimentBreakdown()
    platform_breakdown: list[PlatformCount] = []
    volume_timeline: list[VolumePoint] = []
    recent_alerts: list = []
