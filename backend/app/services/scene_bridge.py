"""Narralytica Scene Bridge — find matching scenes for meme panels."""
import httpx
import json
from app.core.config import get_settings

# Narralytica API on Hetzner
NARRALYTICA_API = "http://host.docker.internal:8005"

# Map property names to Narralytica show IDs
PROPERTY_MAP = {
    "the wayfinders": 1,
    "wayfinders": 1,
    "wingfeather": 2,
    "wingfeather saga": 2,
    "homestead": 3,
}

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"


async def search_scenes(query: str, show_id: int | None = None, limit: int = 5) -> list[dict]:
    """Search Narralytica for scenes matching a query."""
    async with httpx.AsyncClient(timeout=20) as client:
        payload = {"query": query, "limit": limit, "min_confidence": 0.6}
        if show_id:
            payload["show_id"] = show_id

        try:
            resp = await client.post(f"{NARRALYTICA_API}/api/search", json=payload)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"Narralytica search failed: {e}")
            return []


async def get_scene_thumbnail(scene_id: int) -> str | None:
    """Get the thumbnail URL for a scene."""
    return f"{NARRALYTICA_API}/api/media/thumbs/scene_{scene_id:03d}.jpg"


async def generate_panel_queries(template_name: str, panel_descriptions: list[dict],
                                  topic: str, property_name: str) -> list[str]:
    """Use Gemini to generate search queries for each meme panel.

    Given a meme template and its panel meanings, generate queries that will
    find matching emotional moments in the property's footage.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        # Fallback: use panel descriptions directly
        return [p.get("typical_meaning", "emotional scene") for p in panel_descriptions]

    prompt = f"""You are helping find video scenes that match the emotional beats of a meme template.

Meme template: "{template_name}"
Topic/Context: "{topic}"
Property (TV show): "{property_name}"

For each panel of this meme, write a short search query (5-15 words) that describes what kind of scene from "{property_name}" would work in that panel. Focus on emotion, action, and character expression.

{json.dumps(panel_descriptions) if panel_descriptions else f"This is a {template_name} meme with standard panels."}

Return a JSON array of search query strings, one per panel. Example:
["character looking disgusted or rejecting something", "character looking excited and pointing happily"]

Return ONLY the JSON array."""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{GEMINI_API}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
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
            return json.loads(text)
    except Exception as e:
        print(f"Panel query generation failed: {e}")
        # Fallback
        return ["emotional character scene"] * max(len(panel_descriptions), 2)


async def find_scenes_for_meme(template_name: str, panel_descriptions: list[dict],
                                topic: str, property_name: str) -> list[dict]:
    """Full pipeline: generate queries → search Narralytica → return best scenes per panel.

    Returns list of scene dicts, one per panel, with thumbnail URLs.
    """
    show_id = PROPERTY_MAP.get(property_name.lower())

    # Generate queries for each panel
    queries = await generate_panel_queries(template_name, panel_descriptions, topic, property_name)

    scenes_per_panel = []
    for i, query in enumerate(queries):
        results = await search_scenes(query, show_id=show_id, limit=3)
        if results:
            # Pick the best match (highest similarity)
            best = results[0] if isinstance(results[0], dict) else results[0]
            scene_data = {
                "panel_index": i,
                "query": query,
                "scene": best,
                "thumbnail_url": await get_scene_thumbnail(
                    best.get("scene", {}).get("id", 0) if isinstance(best, dict) else 0
                ),
            }
            scenes_per_panel.append(scene_data)
        else:
            scenes_per_panel.append({
                "panel_index": i,
                "query": query,
                "scene": None,
                "thumbnail_url": None,
            })

    return scenes_per_panel
