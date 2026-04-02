import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, ARRAY, Float, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_id: Mapped[str] = mapped_column(String(512), nullable=False)
    author_id: Mapped[str | None] = mapped_column(String(512))
    author_username: Mapped[str | None] = mapped_column(String(255))
    author_display_name: Mapped[str | None] = mapped_column(String(512))
    content: Mapped[str | None] = mapped_column(Text)
    content_html: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id"))
    thread_root_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id"))
    media_urls: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    engagement: Mapped[dict] = mapped_column(JSONB, default={})
    raw_metadata: Mapped[dict] = mapped_column(JSONB, default={})
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostAnalysis(Base):
    __tablename__ = "post_analysis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), unique=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    sentiment_label: Mapped[str | None] = mapped_column(String(20))
    emotions: Mapped[dict] = mapped_column(JSONB, default={})
    entities: Mapped[list] = mapped_column(JSONB, default=[])
    topics: Mapped[list] = mapped_column(JSONB, default=[])
    aspect_sentiments: Mapped[list] = mapped_column(JSONB, default=[])
    embedding = mapped_column(Vector(384))
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
