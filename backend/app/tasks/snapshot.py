from sqlalchemy import text
from app.worker import celery_app
from app.tasks.collect import get_sync_session


@celery_app.task(name="app.tasks.snapshot.take_volume_snapshots")
def take_volume_snapshots():
    """Aggregate post counts and sentiment into hourly snapshots."""
    session = get_sync_session()
    try:
        session.execute(text("""
            INSERT INTO volume_snapshots (topic_id, platform, hour, post_count, avg_sentiment)
            SELECT
                tp.topic_id,
                p.platform,
                date_trunc('hour', p.created_at) AS hour,
                COUNT(*) AS post_count,
                AVG(pa.sentiment_score) AS avg_sentiment
            FROM topic_posts tp
            JOIN posts p ON p.id = tp.post_id
            LEFT JOIN post_analysis pa ON pa.post_id = p.id
            WHERE p.created_at >= NOW() - INTERVAL '2 hours'
            GROUP BY tp.topic_id, p.platform, date_trunc('hour', p.created_at)
            ON CONFLICT (topic_id, platform, hour) DO UPDATE SET
                post_count = EXCLUDED.post_count,
                avg_sentiment = EXCLUDED.avg_sentiment
        """))
        session.commit()
        return {"status": "snapshots updated"}
    finally:
        session.close()
