from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()


@router.get("/topic/{topic_id}")
async def get_topic_graph(
    topic_id: UUID,
    max_nodes: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Build a graph of authors and their connections within a topic.

    Nodes: authors who posted about this topic
    Edges:
      - REPLIED_TO: author A replied to author B's post
      - CO_TOPIC: both authors posted about the same topic
      - MENTIONED: author mentioned in another author's post entities
    """
    nodes = {}
    edges = []

    # Get all authors who posted on this topic with their stats
    authors_result = await db.execute(text("""
        SELECT
            p.author_username,
            p.platform,
            COUNT(*) as post_count,
            AVG(pa.sentiment_score) as avg_sentiment,
            MAX(p.created_at) as last_active,
            COALESCE(SUM((p.engagement->>'likes')::int), 0) +
            COALESCE(SUM((p.engagement->>'score')::int), 0) +
            COALESCE(SUM((p.engagement->>'points')::int), 0) as total_engagement
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        LEFT JOIN post_analysis pa ON pa.post_id = p.id
        WHERE tp.topic_id = :topic_id
            AND p.author_username IS NOT NULL
            AND p.author_username != '[deleted]'
        GROUP BY p.author_username, p.platform
        ORDER BY post_count DESC
        LIMIT :max_nodes
    """), {"topic_id": str(topic_id), "max_nodes": max_nodes})

    for row in authors_result.fetchall():
        node_id = f"{row.platform}:{row.author_username}"
        nodes[node_id] = {
            "id": node_id,
            "label": row.author_username,
            "platform": row.platform,
            "post_count": row.post_count,
            "avg_sentiment": round(row.avg_sentiment, 3) if row.avg_sentiment else 0,
            "total_engagement": row.total_engagement or 0,
            "last_active": row.last_active.isoformat() if row.last_active else None,
            "type": "author",
        }

    # Get reply connections (author A replied to a post by author B)
    replies_result = await db.execute(text("""
        SELECT DISTINCT
            child.author_username as from_author,
            child.platform as from_platform,
            parent.author_username as to_author,
            parent.platform as to_platform,
            COUNT(*) as reply_count
        FROM topic_posts tp
        JOIN posts child ON child.id = tp.post_id
        JOIN posts parent ON parent.platform = child.platform
            AND parent.platform_id = child.parent_platform_id
        WHERE tp.topic_id = :topic_id
            AND child.parent_platform_id IS NOT NULL
            AND child.author_username IS NOT NULL
            AND parent.author_username IS NOT NULL
            AND child.author_username != parent.author_username
            AND child.author_username != '[deleted]'
            AND parent.author_username != '[deleted]'
        GROUP BY child.author_username, child.platform, parent.author_username, parent.platform
    """), {"topic_id": str(topic_id)})

    for row in replies_result.fetchall():
        source = f"{row.from_platform}:{row.from_author}"
        target = f"{row.to_platform}:{row.to_author}"
        if source in nodes and target in nodes:
            edges.append({
                "source": source,
                "target": target,
                "type": "replied_to",
                "weight": row.reply_count,
            })

    # Get entity co-occurrence connections (two authors mentioned the same entity)
    entity_result = await db.execute(text("""
        WITH author_entities AS (
            SELECT DISTINCT
                p.author_username,
                p.platform,
                ent->>'name' as entity_name,
                ent->>'type' as entity_type
            FROM topic_posts tp
            JOIN posts p ON p.id = tp.post_id
            JOIN post_analysis pa ON pa.post_id = p.id,
            jsonb_array_elements(pa.entities) as ent
            WHERE tp.topic_id = :topic_id
                AND p.author_username IS NOT NULL
                AND p.author_username != '[deleted]'
                AND jsonb_array_length(pa.entities) > 0
        )
        SELECT
            a1.author_username as author1, a1.platform as platform1,
            a2.author_username as author2, a2.platform as platform2,
            COUNT(DISTINCT a1.entity_name) as shared_entities
        FROM author_entities a1
        JOIN author_entities a2 ON a1.entity_name = a2.entity_name
            AND (a1.author_username != a2.author_username OR a1.platform != a2.platform)
            AND a1.author_username < a2.author_username
        GROUP BY a1.author_username, a1.platform, a2.author_username, a2.platform
        HAVING COUNT(DISTINCT a1.entity_name) >= 1
    """), {"topic_id": str(topic_id)})

    for row in entity_result.fetchall():
        source = f"{row.platform1}:{row.author1}"
        target = f"{row.platform2}:{row.author2}"
        if source in nodes and target in nodes:
            edges.append({
                "source": source,
                "target": target,
                "type": "shared_entities",
                "weight": row.shared_entities,
            })

    # Add topic node at center
    nodes["__topic__"] = {
        "id": "__topic__",
        "label": "Topic",
        "type": "topic",
        "platform": "none",
        "post_count": 0,
        "avg_sentiment": 0,
        "total_engagement": 0,
    }

    # Connect all authors to topic
    for node_id, node in nodes.items():
        if node["type"] == "author":
            edges.append({
                "source": node_id,
                "target": "__topic__",
                "type": "posted_about",
                "weight": node["post_count"],
            })

    # Also extract named entities as separate nodes
    entities_result = await db.execute(text("""
        SELECT
            ent->>'name' as name,
            ent->>'type' as type,
            COUNT(DISTINCT p.id) as mention_count,
            COUNT(DISTINCT p.author_username) as mentioned_by_count
        FROM topic_posts tp
        JOIN posts p ON p.id = tp.post_id
        JOIN post_analysis pa ON pa.post_id = p.id,
        jsonb_array_elements(pa.entities) as ent
        WHERE tp.topic_id = :topic_id
            AND jsonb_array_length(pa.entities) > 0
        GROUP BY ent->>'name', ent->>'type'
        HAVING COUNT(DISTINCT p.id) >= 2
        ORDER BY mention_count DESC
        LIMIT 30
    """), {"topic_id": str(topic_id)})

    for row in entities_result.fetchall():
        ent_id = f"entity:{row.name}"
        nodes[ent_id] = {
            "id": ent_id,
            "label": row.name,
            "type": "entity",
            "entity_type": row.type,
            "platform": "none",
            "mention_count": row.mention_count,
            "mentioned_by_count": row.mentioned_by_count,
            "post_count": 0,
            "avg_sentiment": 0,
            "total_engagement": 0,
        }

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "authors": sum(1 for n in nodes.values() if n["type"] == "author"),
            "entities": sum(1 for n in nodes.values() if n["type"] == "entity"),
        },
    }
