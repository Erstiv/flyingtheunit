import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), default="person")
    description: Mapped[str | None] = mapped_column(Text)
    influence_score: Mapped[float] = mapped_column(Float, default=0.0)
    merged_into: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EntityIdentity(Base):
    __tablename__ = "entity_identities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_user_id: Mapped[str | None] = mapped_column(String(512))
    username: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(512))
    profile_url: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    follower_count: Mapped[int | None] = mapped_column()
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    raw_profile: Mapped[dict] = mapped_column(JSONB, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
