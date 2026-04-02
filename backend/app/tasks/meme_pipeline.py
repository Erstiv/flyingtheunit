"""Automated Meme Response Pipeline.

End-to-end: detect meme → identify template → match scenes → generate response → queue.
"""
import asyncio
import json
from sqlalchemy import text
from app.worker import celery_app
from app.tasks.collect import get_sync_session


@celery_app.task(name="app.tasks.meme_pipeline.run_meme_pipeline")
def run_meme_pipeline(topic_id: str = None, batch_size: int = 5):
    """Process detected memes and generate response memes.

    For each meme that has been analyzed but not yet responded to:
    1. Look up template in meme DB (or create from discovery)
    2. Find matching scenes from Narralytica
    3. Select character to respond
    4. Generate meme text in character voice
    5. Composite the meme image
    6. Queue for approval
    """
    session = get_sync_session()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        # Find memes that have been analyzed but not yet queued for response
        conditions = """
            ma.id IS NOT NULL
            AND ma.template_name IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM meme_queue mq
                WHERE mq.response_to_post_id = p.id
            )
        """
        params = {"batch_size": batch_size}

        if topic_id:
            conditions += " AND tp.topic_id = :topic_id"
            params["topic_id"] = topic_id

        result = session.execute(text(f"""
            SELECT p.id as post_id, p.content, p.platform, p.url, p.media_urls,
                   ma.template_name, ma.humor_type, ma.target_sentiment,
                   ma.meme_description, ma.image_url,
                   tp.topic_id, t.name as topic_name
            FROM posts p
            JOIN meme_analysis ma ON ma.post_id = p.id
            JOIN topic_posts tp ON tp.post_id = p.id
            JOIN topics t ON t.id = tp.topic_id
            WHERE {conditions}
            ORDER BY p.created_at DESC
            LIMIT :batch_size
        """), params)

        memes = result.fetchall()
        if not memes:
            return {"generated": 0, "message": "No unprocessed memes found"}

        generated = 0
        for meme in memes:
            try:
                response = loop.run_until_complete(
                    _process_single_meme(session, meme)
                )
                if response:
                    generated += 1
            except Exception as e:
                print(f"Pipeline failed for post {meme.post_id}: {e}")
                continue

        return {"generated": generated}

    finally:
        loop.close()
        session.close()


async def _process_single_meme(session, meme):
    """Process a single detected meme through the full pipeline."""
    from app.services.meme_db import identify_template, add_template_from_discovery
    from app.services.scene_bridge import find_scenes_for_meme
    from app.services.character_manager import select_character_for_meme, generate_meme_text
    from app.services.meme_compositor import composite_meme

    template_name = meme.template_name
    topic_name = meme.topic_name
    humor_type = meme.humor_type

    print(f"[Pipeline] Processing: '{template_name}' about '{topic_name}'")

    # Step 1: Ensure template is in our DB
    if meme.image_url:
        template = await identify_template(session, meme.image_url, threshold=15)
    else:
        template = None

    if not template:
        # Add from discovery
        await add_template_from_discovery(
            session, template_name, meme.image_url or "",
            {"humor_type": humor_type, "target_sentiment": meme.target_sentiment}
        )
        # Use basic 2-panel layout
        panel_descriptions = [
            {"position": "top", "typical_meaning": "setup or rejection"},
            {"position": "bottom", "typical_meaning": "punchline or preference"},
        ]
        panel_layout = "top_bottom"
        panel_count = 2
    else:
        panel_descriptions = template.get("panel_descriptions", [])
        panel_layout = template.get("panel_layout", "top_bottom")
        panel_count = template.get("panel_count", 2)

    # Step 2: Find matching scenes from Narralytica
    # Map topic to property name (for now, use topic name)
    property_name = topic_name
    scenes = await find_scenes_for_meme(
        template_name, panel_descriptions, topic_name, property_name
    )
    scene_urls = [s.get("thumbnail_url") for s in scenes if s.get("thumbnail_url")]

    # Step 3: Select character
    character = select_character_for_meme(
        session, property_id=property_name.lower(), humor_type=humor_type
    )

    # Step 4: Generate meme text
    if character:
        texts = await generate_meme_text(
            character["personality"], template_name, topic_name,
            context=meme.meme_description or meme.content or "",
            panel_count=panel_count,
        )
    else:
        texts = ["", ""]  # No character, no text

    # Step 5: Composite the meme
    generated_path = None
    if scene_urls:
        generated_path = await composite_meme(panel_layout, scene_urls, texts)

    # Step 6: Queue for approval
    session.execute(text("""
        INSERT INTO meme_queue (
            topic_id, source_post_id, template_id, template_name,
            top_text, bottom_text, image_url, generated_image_url,
            character_id, scene_thumbnails, response_to_post_id,
            target_platforms, status
        ) VALUES (
            :topic_id, :source_post_id, :template_id, :template_name,
            :top_text, :bottom_text, :image_url, :generated_image_url,
            :character_id, :scene_thumbnails, :response_to_post_id,
            :target_platforms, 'pending_review'
        )
    """), {
        "topic_id": str(meme.topic_id),
        "source_post_id": str(meme.post_id),
        "template_id": template.get("id") if template else None,
        "template_name": template_name,
        "top_text": texts[0] if texts else "",
        "bottom_text": texts[1] if len(texts) > 1 else "",
        "image_url": meme.image_url,
        "generated_image_url": generated_path,
        "character_id": character["id"] if character else None,
        "scene_thumbnails": scene_urls[:5],
        "response_to_post_id": str(meme.post_id),
        "target_platforms": [],
    })
    session.commit()

    print(f"[Pipeline] Queued response to '{template_name}' with {len(scene_urls)} scenes")
    return True
