from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.dashboard import DashboardOverview, PlatformCount, SentimentBreakdown, VolumePoint

router = APIRouter()


@router.get("/", response_model=DashboardOverview)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    # Total counts
    totals = await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM posts) as total_posts,
            (SELECT COUNT(*) FROM entities) as total_entities,
            (SELECT COUNT(*) FROM topics WHERE is_active = true) as active_topics,
            (SELECT COUNT(*) FROM posts WHERE collected_at > NOW() - INTERVAL '24 hours') as posts_24h
    """))
    t = totals.fetchone()

    # Sentiment breakdown (last 24h)
    sentiment = await db.execute(text("""
        SELECT pa.sentiment_label, COUNT(*) as count
        FROM post_analysis pa
        JOIN posts p ON p.id = pa.post_id
        WHERE p.collected_at > NOW() - INTERVAL '24 hours'
        GROUP BY pa.sentiment_label
    """))
    sb = SentimentBreakdown()
    for row in sentiment.fetchall():
        if row.sentiment_label:
            setattr(sb, row.sentiment_label, row.count)

    # Platform breakdown
    platforms = await db.execute(text("""
        SELECT platform, COUNT(*) as count
        FROM posts
        WHERE collected_at > NOW() - INTERVAL '24 hours'
        GROUP BY platform
        ORDER BY count DESC
    """))
    platform_counts = [PlatformCount(platform=r.platform, count=r.count) for r in platforms.fetchall()]

    # Volume timeline (last 72h, hourly)
    volume = await db.execute(text("""
        SELECT hour, SUM(post_count) as count, AVG(avg_sentiment) as avg_sentiment
        FROM volume_snapshots
        WHERE hour >= NOW() - INTERVAL '72 hours'
        GROUP BY hour
        ORDER BY hour ASC
    """))
    volume_points = [
        VolumePoint(hour=r.hour, count=r.count, avg_sentiment=r.avg_sentiment)
        for r in volume.fetchall()
    ]

    # Recent alerts
    alerts = await db.execute(text("""
        SELECT ae.id, ae.triggered_at, ae.details, a.alert_type
        FROM alert_events ae
        JOIN alerts a ON a.id = ae.alert_id
        WHERE ae.acknowledged = false
        ORDER BY ae.triggered_at DESC
        LIMIT 10
    """))
    recent_alerts = [
        {"id": str(r.id), "triggered_at": r.triggered_at.isoformat(), "details": r.details, "type": r.alert_type}
        for r in alerts.fetchall()
    ]

    return DashboardOverview(
        total_posts=t.total_posts or 0,
        total_entities=t.total_entities or 0,
        active_topics=t.active_topics or 0,
        posts_24h=t.posts_24h or 0,
        sentiment_breakdown=sb,
        platform_breakdown=platform_counts,
        volume_timeline=volume_points,
        recent_alerts=recent_alerts,
    )
