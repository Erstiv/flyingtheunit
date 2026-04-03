import asyncio
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from app.worker import celery_app
from app.core.config import get_settings
from app.adapters.reddit import RedditAdapter
from app.adapters.youtube import YouTubeAdapter
from app.adapters.bluesky import BlueskyAdapter
from app.adapters.hackernews import HackerNewsAdapter
from app.adapters.imgur import ImgurAdapter
from app.adapters.mastodon import MastodonAdapter
from app.adapters.googlenews import GoogleNewsAdapter
from app.adapters.base import RawPost

# Registry of available adapters
ADAPTERS = {
    "reddit": RedditAdapter,
    "youtube": YouTubeAdapter,
    "bluesky": BlueskyAdapter,
    "hackernews": HackerNewsAdapter,
    "imgur": ImgurAdapter,
    "mastodon": MastodonAdapter,
    "googlenews": GoogleNewsAdapter,
}


def get_sync_session():
    """Get a synchronous DB session for Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    settings = get_settings()
    engine = create_engine(settings.database_url_sync)
    return Session(engine)


def store_posts(session, posts: list[RawPost], topic_id: str):
    """Store collected posts and link them to the topic."""
    for raw in posts:
        result = session.execute(text("""
            INSERT INTO posts (platform, platform_id, author_id, author_username,
                author_display_name, content, content_html, url, media_urls,
                engagement, raw_metadata, created_at)
            VALUES (:platform, :platform_id, :author_id, :author_username,
                :author_display_name, :content, :content_html, :url, :media_urls,
                :engagement, :raw_metadata, :created_at)
            ON CONFLICT (platform, platform_id) DO UPDATE SET
                engagement = EXCLUDED.engagement,
                collected_at = NOW()
            RETURNING id
        """), {
            "platform": raw.platform,
            "platform_id": raw.platform_id,
            "author_id": raw.author_id,
            "author_username": raw.author_username,
            "author_display_name": raw.author_display_name,
            "content": raw.content,
            "content_html": raw.content_html,
            "url": raw.url,
            "media_urls": raw.media_urls or [],
            "engagement": json.dumps(raw.engagement),
            "raw_metadata": json.dumps(raw.raw_metadata),
            "created_at": raw.created_at,
        })

        post_id = result.scalar()

        # Link to topic
        session.execute(text("""
            INSERT INTO topic_posts (topic_id, post_id)
            VALUES (:topic_id, :post_id)
            ON CONFLICT DO NOTHING
        """), {"topic_id": topic_id, "post_id": post_id})

    session.commit()
    return len(posts)


@celery_app.task(name="app.tasks.collect.collect_for_topic")
def collect_for_topic(topic_id: str, topic_name: str, keywords: list[str], platforms: list[str]):
    """Collect posts for a single topic from all configured adapters."""
    since = datetime.now(timezone.utc) - timedelta(days=7)
    total_collected = 0

    session = get_sync_session()
    try:
        for platform_name, adapter_class in ADAPTERS.items():
            if platforms and platform_name not in platforms:
                continue

            adapter = adapter_class()
            if not adapter.is_configured():
                continue

            for keyword in keywords:
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    posts = loop.run_until_complete(
                        adapter.search(query=keyword, since=since, limit=50)
                    )
                    loop.close()
                    if posts:
                        count = store_posts(session, posts, topic_id)
                        total_collected += count
                        print(f"[{platform_name}] Collected {count} posts for '{keyword}'")

                        # Queue NLP processing for new posts
                        from app.tasks.process import process_unanalyzed_posts
                        process_unanalyzed_posts.delay()

                except Exception as e:
                    print(f"[{platform_name}] Error collecting '{keyword}': {e}")
    finally:
        session.close()

    return {"topic": topic_name, "collected": total_collected}


@celery_app.task(name="app.tasks.collect.collect_all_topics")
def collect_all_topics():
    """Collect posts for all active topics. Triggered by Celery Beat."""
    session = get_sync_session()
    try:
        result = session.execute(text("SELECT id, name, keywords, platforms FROM topics WHERE is_active = true"))
        topics = result.fetchall()

        for topic in topics:
            collect_for_topic.delay(
                str(topic.id),
                topic.name,
                topic.keywords,
                topic.platforms or [],
            )

        return {"queued_topics": len(topics)}
    finally:
        session.close()
