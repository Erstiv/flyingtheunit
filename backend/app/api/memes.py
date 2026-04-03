from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.meme_generator import get_popular_templates, generate_meme, find_template_by_name

router = APIRouter()


@router.get("/trending/{topic_id}")
async def get_trending_memes(
    topic_id: UUID,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get memes found for a topic, sorted by engagement."""
    result = await db.execute(text("""
        SELECT
            p.id as post_id, p.platform, p.author_username, p.content, p.url,
            p.media_urls, p.engagement, p.created_at, p.raw_metadata,
            ma.template_name, ma.meme_text_top, ma.meme_text_bottom,
            ma.meme_description, ma.humor_type, ma.target_sentiment,
            ma.image_url,
            pa.sentiment_score, pa.sentiment_label
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        LEFT JOIN meme_analysis ma ON ma.post_id = p.id
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE tp.topic_id = :topic_id
            AND (
                ma.id IS NOT NULL
                OR array_length(p.media_urls, 1) > 0
                OR p.platform = 'imgur'
            )
        ORDER BY
            COALESCE((p.engagement->>'points')::int, 0) +
            COALESCE((p.engagement->>'ups')::int, 0) +
            COALESCE((p.engagement->>'likes')::int, 0) +
            COALESCE((p.engagement->>'views')::int, 0) / 100
        DESC
        LIMIT :limit
    """), {"topic_id": str(topic_id), "limit": limit})

    memes = []
    for row in result.fetchall():
        memes.append({
            "post_id": str(row.post_id),
            "platform": row.platform,
            "author": row.author_username,
            "content": row.content,
            "url": row.url,
            "image_url": row.image_url or (row.media_urls[0] if row.media_urls else None),
            "engagement": row.engagement or {},
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "template_name": row.template_name,
            "meme_text_top": row.meme_text_top,
            "meme_text_bottom": row.meme_text_bottom,
            "meme_description": row.meme_description,
            "humor_type": row.humor_type,
            "target_sentiment": row.target_sentiment,
            "sentiment_score": row.sentiment_score,
            "sentiment_label": row.sentiment_label,
        })

    return memes


@router.get("/templates")
async def list_templates():
    """Get popular meme templates from Imgflip."""
    return await get_popular_templates()


class MemeCreateRequest(BaseModel):
    template_id: str
    top_text: str = ""
    bottom_text: str = ""
    topic_id: str | None = None
    source_post_id: str | None = None
    target_platforms: list[str] = []


@router.post("/generate")
async def generate_meme_endpoint(
    req: MemeCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a meme and add it to the approval queue."""
    result = await generate_meme(
        template_id=req.template_id,
        top_text=req.top_text,
        bottom_text=req.bottom_text,
    )

    if not result:
        raise HTTPException(500, "Failed to generate meme")

    # Find template name
    template_name = result.get("template_name", "")
    if not template_name:
        templates = await get_popular_templates()
        for t in templates:
            if t["id"] == req.template_id:
                template_name = t["name"]
                break

    # Add to queue
    await db.execute(text("""
        INSERT INTO meme_queue (
            topic_id, source_post_id, template_id, template_name,
            top_text, bottom_text, image_url, target_platforms, status
        ) VALUES (
            :topic_id, :source_post_id, :template_id, :template_name,
            :top_text, :bottom_text, :image_url, :target_platforms, 'draft'
        )
    """), {
        "topic_id": req.topic_id,
        "source_post_id": req.source_post_id,
        "template_id": req.template_id,
        "template_name": template_name,
        "top_text": req.top_text,
        "bottom_text": req.bottom_text,
        "image_url": result.get("url"),
        "target_platforms": req.target_platforms or [],
    })
    await db.commit()

    return {**result, "status": "queued_for_approval"}


@router.get("/queue")
async def get_meme_queue(
    status: str = "draft",
    db: AsyncSession = Depends(get_db),
):
    """Get memes in the approval queue."""
    result = await db.execute(text("""
        SELECT * FROM meme_queue
        WHERE status = :status
        ORDER BY created_at DESC
    """), {"status": status})

    return [
        {
            "id": str(row.id),
            "template_name": row.template_name,
            "top_text": row.top_text,
            "bottom_text": row.bottom_text,
            "image_url": row.image_url,
            "target_platforms": row.target_platforms,
            "status": row.status,
            "created_at": row.created_at.isoformat(),
        }
        for row in result.fetchall()
    ]


@router.post("/queue/{meme_id}/approve")
async def approve_meme(meme_id: UUID, db: AsyncSession = Depends(get_db)):
    """Approve a meme for posting."""
    await db.execute(text("""
        UPDATE meme_queue SET status = 'approved', approved_at = NOW()
        WHERE id = :id
    """), {"id": str(meme_id)})
    await db.commit()
    return {"status": "approved"}


@router.post("/queue/{meme_id}/unapprove")
async def unapprove_meme(meme_id: UUID, db: AsyncSession = Depends(get_db)):
    """Revoke approval — move back to pending review."""
    await db.execute(text("""
        UPDATE meme_queue SET status = 'pending_review', approved_at = NULL
        WHERE id = :id
    """), {"id": str(meme_id)})
    await db.commit()
    return {"status": "pending_review"}


@router.post("/queue/{meme_id}/reject")
async def reject_meme(meme_id: UUID, db: AsyncSession = Depends(get_db)):
    """Reject a meme."""
    await db.execute(text("""
        UPDATE meme_queue SET status = 'rejected'
        WHERE id = :id
    """), {"id": str(meme_id)})
    await db.commit()
    return {"status": "rejected"}


@router.post("/queue/{meme_id}/repost")
async def repost_meme(meme_id: UUID, db: AsyncSession = Depends(get_db)):
    """Requeue a posted or failed meme for reposting."""
    await db.execute(text("""
        UPDATE meme_queue SET status = 'approved', posted_at = NULL
        WHERE id = :id
    """), {"id": str(meme_id)})
    await db.commit()
    return {"status": "approved"}


@router.get("/template-stats/{topic_id}")
async def get_template_stats(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get which meme templates are being used most for a topic."""
    result = await db.execute(text("""
        SELECT
            ma.template_name,
            COUNT(*) as usage_count,
            AVG(pa.sentiment_score) as avg_sentiment,
            ma.humor_type,
            MAX(p.created_at) as latest
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        JOIN meme_analysis ma ON ma.post_id = p.id
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE tp.topic_id = :topic_id
            AND ma.template_name IS NOT NULL
        GROUP BY ma.template_name, ma.humor_type
        ORDER BY usage_count DESC
    """), {"topic_id": str(topic_id)})

    return [
        {
            "template_name": row.template_name,
            "usage_count": row.usage_count,
            "avg_sentiment": round(row.avg_sentiment, 3) if row.avg_sentiment else 0,
            "humor_type": row.humor_type,
            "latest": row.latest.isoformat() if row.latest else None,
        }
        for row in result.fetchall()
    ]
