from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.topic import Topic
from app.models.post import Post, PostAnalysis
from app.schemas.topic import TopicCreate, TopicUpdate, TopicResponse, TopicStats
from app.schemas.post import PostWithAnalysis, PostFeed

router = APIRouter()


@router.get("/", response_model=list[TopicResponse])
async def list_topics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).order_by(Topic.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=TopicResponse, status_code=201)
async def create_topic(data: TopicCreate, db: AsyncSession = Depends(get_db)):
    topic = Topic(**data.model_dump())
    db.add(topic)
    await db.commit()
    await db.refresh(topic)

    # Trigger immediate collection
    from app.tasks.collect import collect_for_topic
    collect_for_topic.delay(str(topic.id), topic.name, topic.keywords, topic.platforms)

    return topic


@router.get("/{topic_id}", response_model=TopicStats)
async def get_topic(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(404, "Topic not found")

    # Get stats
    stats_result = await db.execute(text("""
        SELECT
            COUNT(DISTINCT p.id) as total_posts,
            AVG(pa.sentiment_score) as avg_sentiment,
            COUNT(DISTINCT p.id) FILTER (WHERE p.collected_at > NOW() - INTERVAL '24 hours') as volume_24h
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE tp.topic_id = :topic_id
    """), {"topic_id": str(topic_id)})
    stats = stats_result.fetchone()

    # Platform breakdown
    platform_result = await db.execute(text("""
        SELECT p.platform, COUNT(*) as count
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        WHERE tp.topic_id = :topic_id
        GROUP BY p.platform
        ORDER BY count DESC
    """), {"topic_id": str(topic_id)})
    platforms = {row.platform: row.count for row in platform_result.fetchall()}

    return TopicStats(
        topic=TopicResponse.model_validate(topic),
        total_posts=stats.total_posts or 0,
        avg_sentiment=stats.avg_sentiment,
        platform_breakdown=platforms,
        volume_24h=stats.volume_24h or 0,
    )


@router.patch("/{topic_id}", response_model=TopicResponse)
async def update_topic(topic_id: UUID, data: TopicUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(404, "Topic not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=204)
async def delete_topic(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(404, "Topic not found")

    await db.delete(topic)
    await db.commit()


@router.get("/{topic_id}/posts", response_model=PostFeed)
async def get_topic_posts(
    topic_id: UUID,
    page: int = 1,
    page_size: int = 20,
    sentiment: str | None = None,
    platform: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    # Verify topic exists
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Topic not found")

    offset = (page - 1) * page_size

    # Build query with filters
    conditions = ["tp.topic_id = :topic_id"]
    params = {"topic_id": str(topic_id), "limit": page_size, "offset": offset}

    if sentiment:
        conditions.append("pa.sentiment_label = :sentiment")
        params["sentiment"] = sentiment
    if platform:
        conditions.append("p.platform = :platform")
        params["platform"] = platform

    where = " AND ".join(conditions)

    # Get posts with analysis
    posts_result = await db.execute(text(f"""
        SELECT p.*, pa.sentiment_score, pa.sentiment_label, pa.emotions, pa.entities
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE {where}
        ORDER BY p.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)

    # Get total count
    count_result = await db.execute(text(f"""
        SELECT COUNT(*)
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE {where}
    """), params)

    total = count_result.scalar()
    rows = posts_result.fetchall()

    posts = []
    for row in rows:
        posts.append(PostWithAnalysis(
            id=row.id,
            platform=row.platform,
            platform_id=row.platform_id,
            author_username=row.author_username,
            author_display_name=row.author_display_name,
            content=row.content,
            url=row.url,
            engagement=row.engagement or {},
            created_at=row.created_at,
            collected_at=row.collected_at,
            sentiment_score=row.sentiment_score,
            sentiment_label=row.sentiment_label,
            emotions=row.emotions or {},
            entities=row.entities or [],
        ))

    return PostFeed(posts=posts, total=total, page=page, page_size=page_size)


@router.get("/{topic_id}/timeline")
async def get_topic_timeline(
    topic_id: UUID,
    hours: int = 72,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT hour, SUM(post_count) as count, AVG(avg_sentiment) as avg_sentiment
        FROM volume_snapshots
        WHERE topic_id = :topic_id AND hour >= NOW() - make_interval(hours => :hours)
        GROUP BY hour
        ORDER BY hour ASC
    """), {"topic_id": str(topic_id), "hours": hours})

    return [
        {"hour": row.hour.isoformat(), "count": row.count, "avg_sentiment": row.avg_sentiment}
        for row in result.fetchall()
    ]
