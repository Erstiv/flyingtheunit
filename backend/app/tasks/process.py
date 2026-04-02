import json
from sqlalchemy import text
from app.worker import celery_app
from app.tasks.collect import get_sync_session
from app.nlp.sentiment import analyze_sentiment
from app.nlp.ner import extract_entities
from app.nlp.embeddings import generate_embedding


@celery_app.task(name="app.tasks.process.process_unanalyzed_posts")
def process_unanalyzed_posts(batch_size: int = 50):
    """Process posts that don't have analysis yet."""
    session = get_sync_session()
    try:
        # Find posts without analysis
        result = session.execute(text("""
            SELECT p.id, p.content
            FROM posts p
            LEFT JOIN post_analysis pa ON pa.post_id = p.id
            WHERE pa.id IS NULL AND p.content IS NOT NULL AND p.content != ''
            ORDER BY p.collected_at DESC
            LIMIT :batch_size
        """), {"batch_size": batch_size})

        posts = result.fetchall()
        if not posts:
            return {"processed": 0}

        processed = 0
        for post in posts:
            post_id, content = post.id, post.content

            # Sentiment
            sentiment = analyze_sentiment(content)

            # NER
            entities = extract_entities(content)

            # Embedding
            embedding = generate_embedding(content)

            # Store analysis
            session.execute(text("""
                INSERT INTO post_analysis (post_id, sentiment_score, sentiment_label, entities, embedding)
                VALUES (:post_id, :score, :label, :entities, :embedding)
                ON CONFLICT (post_id) DO UPDATE SET
                    sentiment_score = EXCLUDED.sentiment_score,
                    sentiment_label = EXCLUDED.sentiment_label,
                    entities = EXCLUDED.entities,
                    embedding = EXCLUDED.embedding,
                    analyzed_at = NOW()
            """), {
                "post_id": str(post_id),
                "score": sentiment["score"],
                "label": sentiment["label"],
                "entities": json.dumps(entities),
                "embedding": str(embedding),
            })
            processed += 1

        session.commit()
        print(f"Processed {processed} posts")
        return {"processed": processed}
    finally:
        session.close()
