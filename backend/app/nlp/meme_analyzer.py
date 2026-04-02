import json
import httpx
from app.core.config import get_settings

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

MEME_ANALYSIS_PROMPT = """Analyze this meme image. Return a JSON object with these fields:

{
  "template_name": "the common name of this meme template (e.g. 'Drake Hotline Bling', 'Distracted Boyfriend', 'Two Buttons', 'Change My Mind'). If unknown, describe the format.",
  "meme_text_top": "text at the top of the meme (if any)",
  "meme_text_bottom": "text at the bottom of the meme (if any)",
  "meme_description": "one sentence describing what this meme is saying/joking about",
  "humor_type": "one of: satirical, celebratory, mocking, absurdist, wholesome, political, self-deprecating, sarcastic",
  "target_sentiment": "one of: positive, negative, neutral, mixed — how the meme feels about its subject",
  "subjects": ["list of people, brands, or topics this meme is about"],
  "is_meme": true/false (is this actually a meme or just a regular image?)
}

Return ONLY the JSON, no markdown formatting."""


async def analyze_meme_image(image_url: str) -> dict | None:
    """Send an image URL to Gemini Vision for meme analysis."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    try:
        # First download the image
        async with httpx.AsyncClient(timeout=30) as client:
            img_resp = await client.get(image_url)
            if not img_resp.is_success:
                return None

            content_type = img_resp.headers.get("content-type", "image/jpeg")
            if not content_type.startswith("image/"):
                return None

            import base64
            image_b64 = base64.b64encode(img_resp.content).decode()

            # Send to Gemini
            gemini_resp = await client.post(
                f"{GEMINI_API}?key={settings.gemini_api_key}",
                json={
                    "contents": [{
                        "parts": [
                            {"text": MEME_ANALYSIS_PROMPT},
                            {
                                "inline_data": {
                                    "mime_type": content_type,
                                    "data": image_b64,
                                }
                            },
                        ]
                    }],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 500,
                    },
                },
                timeout=30,
            )
            gemini_resp.raise_for_status()
            result = gemini_resp.json()

            # Extract text from response
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            # Clean markdown code fences if present
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            return json.loads(text)

    except Exception as e:
        print(f"Meme analysis failed for {image_url}: {e}")
        return None


async def analyze_meme_from_text(title: str, context: str = "") -> dict | None:
    """Analyze if text content is meme-like using Gemini."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    prompt = f"""Is this social media post a meme or meme-related? Analyze it.

Title/Content: {title}
{f'Context: {context}' if context else ''}

Return a JSON object:
{{
  "is_meme": true/false,
  "template_name": "meme template name if recognizable, else null",
  "meme_description": "what the meme/joke is about",
  "humor_type": "satirical/celebratory/mocking/absurdist/wholesome/political/self-deprecating/sarcastic or null",
  "target_sentiment": "positive/negative/neutral/mixed",
  "subjects": ["list of subjects/brands/people referenced"]
}}

Return ONLY JSON."""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{GEMINI_API}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 300},
                },
                timeout=20,
            )
            resp.raise_for_status()
            result = resp.json()
            text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())
    except Exception as e:
        print(f"Meme text analysis failed: {e}")
        return None
