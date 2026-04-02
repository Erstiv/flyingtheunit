import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class VolumeSnapshot(Base):
    __tablename__ = "volume_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"))
    platform: Mapped[str | None] = mapped_column(String(50))
    hour: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    post_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_sentiment: Mapped[float | None] = mapped_column(Float)
    dominant_emotion: Mapped[str | None] = mapped_column(String(50))
