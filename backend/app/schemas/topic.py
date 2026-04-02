from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class TopicCreate(BaseModel):
    name: str
    keywords: list[str]
    platforms: list[str] = []
    collection_interval_minutes: int = 15


class TopicUpdate(BaseModel):
    name: str | None = None
    keywords: list[str] | None = None
    platforms: list[str] | None = None
    is_active: bool | None = None
    collection_interval_minutes: int | None = None


class TopicResponse(BaseModel):
    id: UUID
    name: str
    keywords: list[str]
    platforms: list[str]
    is_active: bool
    collection_interval_minutes: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TopicStats(BaseModel):
    topic: TopicResponse
    total_posts: int = 0
    avg_sentiment: float | None = None
    dominant_emotion: str | None = None
    platform_breakdown: dict[str, int] = {}
    volume_24h: int = 0
