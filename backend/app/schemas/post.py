from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class PostResponse(BaseModel):
    id: UUID
    platform: str
    platform_id: str
    author_username: str | None
    author_display_name: str | None
    content: str | None
    url: str | None
    engagement: dict = {}
    created_at: datetime | None
    collected_at: datetime

    model_config = {"from_attributes": True}


class PostWithAnalysis(PostResponse):
    sentiment_score: float | None = None
    sentiment_label: str | None = None
    emotions: dict = {}
    entities: list = []


class PostFeed(BaseModel):
    posts: list[PostWithAnalysis]
    total: int
    page: int
    page_size: int
