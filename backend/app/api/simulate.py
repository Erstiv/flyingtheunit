"""Meme Pipeline Simulation — step-by-step demo without posting."""
import json
import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import get_settings
from app.nlp.sentiment import analyze_sentiment
from app.nlp.ner import extract_entities
from app.services.meme_compositor import composite_meme, download_image_bytes, ensure_output_dir, OUTPUT_DIR
import os

router = APIRouter()

NARRALYTICA_API = "http://host.docker.internal:8005"
GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"


class SimulateRequest(BaseModel):
    """Simulate a social media post for the meme pipeline."""
    post_text: str
    post_author: str = "u/wayfinders_fan_42"
    platform: str = "reddit"
    meme_template: str | None = None  # optional override
    image_url: str | None = None
    property_name: str = "The Wayfinders"
    show_id: int = 7  # Narralytica show ID


@router.post("/run")
async def simulate_pipeline(req: SimulateRequest, db: AsyncSession = Depends(get_db)):
    """Run the full meme pipeline on a simulated post, returning each step's output.

    Returns a step-by-step breakdown:
    1. Post detected
    2. Sentiment analyzed
    3. Entities extracted
    4. Meme identified (via Gemini)
    5. Scenes matched from Narralytica
    6. Text options generated
    7. Ready for approval
    """
    settings = get_settings()
    steps = []

    # ── Step 1: Post Detected ──
    steps.append({
        "step": 1,
        "title": "Post Detected",
        "description": f"Found a post on {req.platform} mentioning {req.property_name}",
        "data": {
            "platform": req.platform,
            "author": req.post_author,
            "content": req.post_text,
            "image_url": req.image_url,
        }
    })

    # ── Step 2: Sentiment Analysis ──
    sentiment = analyze_sentiment(req.post_text)
    steps.append({
        "step": 2,
        "title": "Sentiment Analyzed",
        "description": f"Post is {sentiment['label']} (score: {sentiment['score']:.2f})",
        "data": sentiment,
    })

    # ── Step 3: Entity Extraction ──
    entities = extract_entities(req.post_text)
    steps.append({
        "step": 3,
        "title": "Entities Extracted",
        "description": f"Found {len(entities)} entities",
        "data": {"entities": entities},
    })

    # ── Step 4: Meme Identification ──
    meme_info = None
    if req.meme_template:
        meme_info = {
            "template_name": req.meme_template,
            "is_meme": True,
            "meme_description": f"A {req.meme_template} meme about {req.property_name}",
            "humor_type": "celebratory",
            "target_sentiment": sentiment["label"],
        }
    elif settings.gemini_api_key:
        # Ask Gemini to analyze the post for meme content
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                prompt = f"""Analyze this social media post. Is it a meme or meme-like? What meme template would work best as a response?

Post: "{req.post_text}"
Platform: {req.platform}
Topic: {req.property_name}

Return JSON:
{{
  "is_meme": true/false,
  "original_template": "meme template used in the post (if any)",
  "best_response_template": "best meme template for responding to this (e.g. Drake Hotline Bling, Distracted Boyfriend, Change My Mind, etc.)",
  "meme_description": "what the post is saying about {req.property_name}",
  "humor_type": "satirical/celebratory/mocking/wholesome/sarcastic",
  "target_sentiment": "positive/negative/neutral",
  "response_angle": "brief description of how to respond to this with a meme"
}}"""

                resp = await client.post(
                    f"{GEMINI_API}?key={settings.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300, "responseMimeType": "application/json"},
                    },
                    timeout=20,
                )
                resp.raise_for_status()
                result = resp.json()
                parts = result["candidates"][0]["content"]["parts"]
                text_out = ""
                for part in parts:
                    if "text" in part:
                        text_out = part["text"]
                meme_info = json.loads(text_out)
        except Exception as e:
            meme_info = {
                "is_meme": False,
                "best_response_template": "Drake Hotline Bling",
                "error": str(e),
            }

    if not meme_info:
        meme_info = {"is_meme": False, "best_response_template": "Drake Hotline Bling"}

    template_name = meme_info.get("best_response_template") or meme_info.get("original_template") or "Drake Hotline Bling"

    # Look up template image from our DB or Imgflip
    template_image_url = None
    try:
        tmpl_result = await db.execute(text("""
            SELECT source_url FROM meme_templates WHERE name ILIKE :name LIMIT 1
        """), {"name": f"%{template_name}%"})
        row = tmpl_result.fetchone()
        if row:
            template_image_url = row.source_url
    except Exception:
        pass

    meme_info["template_image_url"] = template_image_url
    # Add Know Your Meme / explanation link
    safe_name = template_name.replace(" ", "-").replace("'", "").lower()
    meme_info["explanation_url"] = f"https://en.meming.world/wiki/{template_name.replace(' ', '_')}"
    meme_info["knowyourmeme_url"] = f"https://knowyourmeme.com/memes/{safe_name}"

    steps.append({
        "step": 4,
        "title": "Meme Identified",
        "description": f"Best response template: {template_name}",
        "data": meme_info,
    })

    # ── Step 5: Scene Matching from Narralytica ──
    # Generate panel queries — use SHORT keywords (1-3 words) because
    # Narralytica uses keyword search for shows without embeddings
    panel_queries = []
    if settings.gemini_api_key:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                prompt = f"""For a "{template_name}" meme response about "{req.property_name}", I need to search for matching video scenes.

The original post said: "{req.post_text}"
Response angle: {meme_info.get("response_angle", "positive response celebrating the show")}

Generate 2 simple keyword searches (1-3 words each) to find scenes from "{req.property_name}".
Use character names, emotions, or actions. Keep queries SHORT — these are keyword searches, not descriptions.

Return a JSON array of 2 strings. Example:
["frustrated", "celebrating"]"""

                resp = await client.post(
                    f"{GEMINI_API}?key={settings.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 100, "responseMimeType": "application/json"},
                    },
                    timeout=20,
                )
                resp.raise_for_status()
                result = resp.json()
                parts = result["candidates"][0]["content"]["parts"]
                text_out = ""
                for part in parts:
                    if "text" in part:
                        text_out = part["text"]
                panel_queries = json.loads(text_out)
        except Exception as e:
            print(f"Panel query generation failed: {e}")
            panel_queries = ["angry", "excited"]
    else:
        panel_queries = ["angry", "excited"]

    # Search Narralytica for each panel
    scenes = []
    for i, query in enumerate(panel_queries):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{NARRALYTICA_API}/api/search/",
                    json={"query": query, "show_id": req.show_id, "limit": 3, "min_confidence": 0.0},
                    timeout=20,
                )
                resp.raise_for_status()
                results = resp.json()
                panel_scenes = []
                for r in results[:3]:
                    scene = r.get("scene", {})
                    panel_scenes.append({
                        "scene_id": scene.get("id"),
                        "description": scene.get("description_text", "")[:200],
                        "mood": scene.get("mood_ambience"),
                        "tone": scene.get("tone"),
                        "characters": scene.get("characters_present", []),
                        "similarity": round(r.get("similarity", 0), 3),
                        "thumbnail_url": f"/api/simulate/scene-thumb/{scene.get('id', 0)}",
                        "episode": r.get("episode_label", ""),
                    })
                scenes.append({
                    "panel": i + 1,
                    "query": query,
                    "matches": panel_scenes,
                    "selected": panel_scenes[0] if panel_scenes else None,
                })
        except Exception as e:
            scenes.append({"panel": i + 1, "query": query, "matches": [], "error": str(e)})

    steps.append({
        "step": 5,
        "title": "Scenes Matched",
        "description": f"Found {sum(len(s.get('matches', [])) for s in scenes)} matching scenes across {len(scenes)} panels",
        "data": {"panels": scenes},
    })

    # ── Step 6: Generate Text Options ──
    text_options = []
    if settings.gemini_api_key:
        # Generate all 3 tones in a single Gemini call to avoid rate limits
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                prompt = f"""You are writing meme text for 3 different fan account personas for the TV show "{req.property_name}".

Someone posted: "{req.post_text}"
You're making a "{template_name}" meme response.

Write meme text for 3 different tones. Each has a top_text and bottom_text (under 10 words each). Be funny and relevant.

Return a JSON array of 3 objects:
[
  {{"top_text": "...", "bottom_text": "...", "tone": "snarky superfan"}},
  {{"top_text": "...", "bottom_text": "...", "tone": "wholesome enthusiast"}},
  {{"top_text": "...", "bottom_text": "...", "tone": "lore nerd"}}
]"""

                resp = await client.post(
                    f"{GEMINI_API}?key={settings.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.9, "maxOutputTokens": 400, "responseMimeType": "application/json"},
                    },
                    timeout=25,
                )
                resp.raise_for_status()
                result = resp.json()
                parts = result["candidates"][0]["content"]["parts"]
                text_out = ""
                for part in parts:
                    if "text" in part:
                        text_out = part["text"]
                parsed = json.loads(text_out)
                if isinstance(parsed, list):
                    text_options = parsed
                else:
                    text_options = [parsed]
        except Exception as e:
            print(f"Text generation failed: {e}")
    if not text_options:
        text_options = [
            {"top_text": "THEM: IT'S JUST ANOTHER FANTASY SHOW", "bottom_text": "ME: YOU CLEARLY HAVEN'T MET THE CREW", "tone": "snarky superfan"},
            {"top_text": "WHEN SOMEONE SAYS THEY HAVEN'T WATCHED IT", "bottom_text": "ME PLANNING A 12 HOUR MARATHON", "tone": "wholesome enthusiast"},
            {"top_text": "CASUAL VIEWERS: IT'S A KIDS SHOW", "bottom_text": "ME: DID YOU CATCH THE EPISODE 4 FORESHADOWING", "tone": "lore nerd"},
        ]

    steps.append({
        "step": 6,
        "title": "Text Options Generated",
        "description": f"Generated {len(text_options)} text variations in different character voices",
        "data": {"options": text_options},
    })

    # ── Step 7: Ready for Approval ──
    steps.append({
        "step": 7,
        "title": "Ready for Approval",
        "description": "Select your preferred text and scenes, then approve to queue for posting",
        "data": {
            "template": template_name,
            "status": "pending_review",
            "actions": ["approve", "edit", "reject", "regenerate"],
        },
    })

    return {
        "simulation": True,
        "steps": steps,
        "summary": {
            "post": req.post_text,
            "property": req.property_name,
            "sentiment": sentiment["label"],
            "template": template_name,
            "scenes_found": sum(len(s.get("matches", [])) for s in scenes),
            "text_options": len(text_options),
        },
    }


# Preset simulations for demo
PRESET_POSTS = [
    {
        "name": "Positive Fan Meme",
        "post_text": "I can't stop rewatching The Wayfinders. Every time I notice something new. This show is genuinely better than most big-budget fantasy series and it's not even close.",
        "post_author": "u/wayfinders_obsessed",
        "platform": "reddit",
    },
    {
        "name": "Negative Criticism",
        "post_text": "Honestly The Wayfinders season 1 was overhyped. The pacing was slow and the CGI looked cheap compared to what Disney and Netflix are doing. Not sure why everyone keeps recommending it.",
        "post_author": "u/honest_tv_reviews",
        "platform": "reddit",
    },
    {
        "name": "Meme Post (Drake)",
        "post_text": "Watching generic streaming fantasy shows vs Watching The Wayfinders for the 5th time this month",
        "post_author": "u/meme_lord_tv",
        "platform": "reddit",
        "meme_template": "Drake Hotline Bling",
    },
    {
        "name": "YouTube Comment",
        "post_text": "This scene made me cry actual tears. The way they animated Zaya's face when she realizes what she has to do... Angel Studios doesn't get enough credit for what they've done here.",
        "post_author": "AnimationFanatic",
        "platform": "youtube",
    },
]


@router.get("/presets")
async def get_preset_posts():
    """Get preset simulated posts for demo."""
    return PRESET_POSTS


@router.get("/scene-thumb/{scene_id}")
async def proxy_scene_thumbnail(scene_id: int):
    """Proxy Narralytica scene thumbnails so the frontend can display them."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{NARRALYTICA_API}/api/media/thumbs/scene_{scene_id:03d}.jpg")
            if resp.is_success:
                return Response(content=resp.content, media_type="image/jpeg")
            # Try without zero-padding
            resp = await client.get(f"{NARRALYTICA_API}/api/media/thumbs/scene_{scene_id}.jpg")
            if resp.is_success:
                return Response(content=resp.content, media_type="image/jpeg")
    except Exception:
        pass
    return Response(status_code=404)


class CompositeRequest(BaseModel):
    """Request to composite a meme image server-side."""
    scene_ids: list[int]  # scene IDs for each panel
    top_text: str = ""
    bottom_text: str = ""
    layout: str = "top_bottom"  # top_bottom or side_by_side


@router.post("/composite")
async def composite_meme_endpoint(req: CompositeRequest):
    """Generate a composited meme image from scene thumbnails + text.

    Returns the URL path to the generated image.
    """
    # Build scene thumbnail URLs
    scene_urls = [
        f"{NARRALYTICA_API}/api/media/thumbs/scene_{sid:03d}.jpg"
        for sid in req.scene_ids
    ]

    texts = [req.top_text, req.bottom_text]
    result_path = await composite_meme(req.layout, scene_urls, texts)

    if not result_path:
        return Response(status_code=500, content="Failed to generate meme")

    filename = os.path.basename(result_path)
    return {"image_url": f"/api/simulate/generated/{filename}"}


@router.get("/generated/{filename}")
async def serve_generated_meme(filename: str):
    """Serve a generated meme image."""
    # Sanitize filename to prevent path traversal
    safe_name = os.path.basename(filename)
    path = os.path.join(OUTPUT_DIR, safe_name)
    if os.path.exists(path):
        return FileResponse(path, media_type="image/jpeg")
    return Response(status_code=404)
