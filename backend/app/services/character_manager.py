"""Character Manager — manage posting characters and generate meme text in their voice."""
import json
import httpx
from sqlalchemy import text as sql_text
from app.core.config import get_settings

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"


async def generate_meme_text(character_personality: str, template_name: str,
                              topic: str, context: str = "",
                              panel_count: int = 2) -> list[str]:
    """Generate meme text in a character's voice using Gemini.

    Returns list of text strings, one per panel.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        return [""] * panel_count

    prompt = f"""You are a social media character with this personality:
{character_personality}

Write meme text for a "{template_name}" meme about "{topic}".
{f'Context about the original post: {context}' if context else ''}

Rules:
- Keep each line under 10 words
- Match the character's voice and attitude
- Be funny, relevant, and shareable
- Reference specific moments/characters from the show if possible

Return a JSON array of strings, one per panel ({"top and bottom" if panel_count == 2 else f"{panel_count} panels"}).
Example: ["WHEN SOMEONE SAYS THEY HAVEN'T WATCHED IT", "ME PLANNING A 12 HOUR MARATHON"]

Return ONLY the JSON array."""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{GEMINI_API}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.8,  # Higher for creativity
                        "maxOutputTokens": 200,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=20,
            )
            resp.raise_for_status()
            result = resp.json()
            parts = result["candidates"][0]["content"]["parts"]
            text = ""
            for part in parts:
                if "text" in part:
                    text = part["text"]
            texts = json.loads(text)
            return texts if isinstance(texts, list) else [""] * panel_count
    except Exception as e:
        print(f"Meme text generation failed: {e}")
        return [""] * panel_count


def select_character_for_meme(session, property_id: str, humor_type: str = None) -> dict | None:
    """Select the best character to respond to a meme about a property.

    Picks the most relevant active character based on property and humor type.
    """
    result = session.execute(sql_text("""
        SELECT id, name, handle, personality, posting_rules, engagement_stats
        FROM characters
        WHERE property_id = :property_id AND is_active = true
        ORDER BY
            CASE WHEN posting_rules->>'allowed_humor_types' LIKE :humor THEN 0 ELSE 1 END,
            (engagement_stats->>'avg_engagement')::float DESC NULLS LAST
        LIMIT 1
    """), {
        "property_id": property_id,
        "humor": f"%{humor_type}%" if humor_type else "%",
    })

    row = result.fetchone()
    if row:
        return {
            "id": str(row.id),
            "name": row.name,
            "handle": row.handle,
            "personality": row.personality,
            "posting_rules": row.posting_rules,
        }
    return None
