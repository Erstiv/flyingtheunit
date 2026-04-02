import asyncio
import json
from sqlalchemy import text
from app.worker import celery_app
from app.tasks.collect import get_sync_session


@celery_app.task(name="app.tasks.meme.analyze_memes")
def analyze_memes(batch_size: int = 10):
    """Analyze posts with images for meme content using Gemini Vision."""
    session = get_sync_session()
    try:
        # Find posts with image URLs that haven't been meme-analyzed yet
        result = session.execute(text("""
            SELECT p.id, p.content, p.media_urls, p.raw_metadata, p.platform
            FROM posts p
            LEFT JOIN meme_analysis ma ON ma.post_id = p.id
            WHERE ma.id IS NULL
                AND (
                    array_length(p.media_urls, 1) > 0
                    OR p.raw_metadata->>'image_url' IS NOT NULL
                    OR p.raw_metadata->>'is_meme' = 'true'
                    OR p.platform = 'imgur'
                )
            ORDER BY p.collected_at DESC
            LIMIT :batch_size
        """), {"batch_size": batch_size})

        posts = result.fetchall()
        if not posts:
            return {"analyzed": 0}

        analyzed = 0
        for post in posts:
            post_id = post.id
            media_urls = post.media_urls or []
            metadata = post.raw_metadata or {}

            # Get the best image URL
            image_url = (
                metadata.get("image_url")
                or (media_urls[0] if media_urls else None)
            )

            analysis = None
            if image_url and image_url.startswith("http"):
                # Use Gemini Vision for image analysis
                from app.nlp.meme_analyzer import analyze_meme_image
                analysis = asyncio.get_event_loop().run_until_complete(
                    analyze_meme_image(image_url)
                )

            if not analysis and post.content:
                # Fallback: analyze text content for meme-ness
                from app.nlp.meme_analyzer import analyze_meme_from_text
                analysis = asyncio.get_event_loop().run_until_complete(
                    analyze_meme_from_text(post.content)
                )

            if analysis:
                session.execute(text("""
                    INSERT INTO meme_analysis (
                        post_id, template_name, meme_text_top, meme_text_bottom,
                        meme_description, humor_type, target_sentiment,
                        image_url, raw_analysis
                    ) VALUES (
                        :post_id, :template_name, :text_top, :text_bottom,
                        :description, :humor_type, :target_sentiment,
                        :image_url, :raw_analysis
                    ) ON CONFLICT (post_id) DO UPDATE SET
                        template_name = EXCLUDED.template_name,
                        meme_description = EXCLUDED.meme_description,
                        humor_type = EXCLUDED.humor_type,
                        target_sentiment = EXCLUDED.target_sentiment,
                        raw_analysis = EXCLUDED.raw_analysis,
                        analyzed_at = NOW()
                """), {
                    "post_id": str(post_id),
                    "template_name": analysis.get("template_name"),
                    "text_top": analysis.get("meme_text_top"),
                    "text_bottom": analysis.get("meme_text_bottom"),
                    "description": analysis.get("meme_description"),
                    "humor_type": analysis.get("humor_type"),
                    "target_sentiment": analysis.get("target_sentiment"),
                    "image_url": image_url,
                    "raw_analysis": json.dumps(analysis),
                })
                analyzed += 1

        session.commit()
        print(f"Meme-analyzed {analyzed} posts")
        return {"analyzed": analyzed}
    finally:
        session.close()
