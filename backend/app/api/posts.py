from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.post import PostWithAnalysis

router = APIRouter()


@router.get("/{post_id}")
async def get_post(post_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a single post by ID with analysis."""
    result = await db.execute(text("""
        SELECT p.*, pa.sentiment_score, pa.sentiment_label, pa.emotions, pa.entities
        FROM posts p
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE p.id = :id
    """), {"id": str(post_id)})
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Post not found")
    return {
        "id": str(row.id),
        "platform": row.platform,
        "platform_id": row.platform_id,
        "author_username": row.author_username,
        "author_display_name": row.author_display_name,
        "content": row.content,
        "url": row.url,
        "engagement": row.engagement or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "sentiment_score": row.sentiment_score,
        "sentiment_label": row.sentiment_label,
        "emotions": row.emotions or {},
        "entities": row.entities or [],
    }


@router.get("/search")
async def search_posts(
    q: str,
    platform: str | None = None,
    sentiment: str | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across all posts."""
    conditions = ["p.content ILIKE :pattern"]
    params = {"pattern": f"%{q}%", "limit": limit}

    if platform:
        conditions.append("p.platform = :platform")
        params["platform"] = platform
    if sentiment:
        conditions.append("pa.sentiment_label = :sentiment")
        params["sentiment"] = sentiment

    where = " AND ".join(conditions)

    result = await db.execute(text(f"""
        SELECT p.*, pa.sentiment_score, pa.sentiment_label, pa.emotions, pa.entities
        FROM posts p
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE {where}
        ORDER BY p.created_at DESC
        LIMIT :limit
    """), params)

    rows = result.fetchall()
    return [
        PostWithAnalysis(
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
        )
        for row in rows
    ]


@router.get("/semantic-search")
async def semantic_search(
    q: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Semantic similarity search using embeddings."""
    from app.nlp.embeddings import generate_embedding

    query_embedding = generate_embedding(q)

    result = await db.execute(text("""
        SELECT p.*, pa.sentiment_score, pa.sentiment_label,
               pa.embedding <=> :embedding::vector AS distance
        FROM post_analysis pa
        JOIN posts p ON p.id = pa.post_id
        WHERE pa.embedding IS NOT NULL
        ORDER BY pa.embedding <=> :embedding::vector
        LIMIT :limit
    """), {"embedding": str(query_embedding), "limit": limit})

    rows = result.fetchall()
    return [
        {
            "id": str(row.id),
            "platform": row.platform,
            "author_username": row.author_username,
            "content": row.content,
            "url": row.url,
            "sentiment_score": row.sentiment_score,
            "sentiment_label": row.sentiment_label,
            "similarity": 1 - row.distance,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]
