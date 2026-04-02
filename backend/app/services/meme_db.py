"""Meme Template Database — ingest, fingerprint, and match meme templates."""
import json
import os
import httpx
import imagehash
from io import BytesIO
from PIL import Image
from sqlalchemy import text


TEMPLATE_DIR = "/app/data/meme_templates"
IMGFLIP_API = "https://api.imgflip.com"


def ensure_template_dir():
    os.makedirs(TEMPLATE_DIR, exist_ok=True)


async def download_image(url: str) -> Image.Image | None:
    """Download an image from URL and return as PIL Image."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return Image.open(BytesIO(resp.content))
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return None


def compute_phash(image: Image.Image) -> str:
    """Compute perceptual hash of an image."""
    return str(imagehash.phash(image))


def phash_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two perceptual hashes."""
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    return h1 - h2


async def ingest_imgflip_templates(session, limit: int = 100) -> int:
    """Fetch popular meme templates from Imgflip and store them."""
    ensure_template_dir()

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{IMGFLIP_API}/get_memes")
        resp.raise_for_status()
        data = resp.json()

    memes = data.get("data", {}).get("memes", [])[:limit]
    ingested = 0

    for meme in memes:
        name = meme["name"]
        meme_id = meme["id"]
        url = meme["url"]
        box_count = meme.get("box_count", 2)

        # Check if already exists
        existing = session.execute(
            text("SELECT id FROM meme_templates WHERE name = :name"),
            {"name": name}
        ).fetchone()

        if existing:
            continue

        # Download and fingerprint
        img = await download_image(url)
        if not img:
            continue

        phash = compute_phash(img)

        # Save image locally
        safe_name = name.replace("/", "_").replace(" ", "_")[:50]
        img_path = f"{TEMPLATE_DIR}/{safe_name}.jpg"
        try:
            img.convert("RGB").save(img_path, "JPEG")
        except Exception:
            img_path = None

        # Determine panel layout from box_count
        if box_count <= 2:
            layout = "top_bottom"
        elif box_count == 3:
            layout = "vertical_3"
        elif box_count == 4:
            layout = "grid_2x2"
        else:
            layout = f"custom_{box_count}"

        session.execute(text("""
            INSERT INTO meme_templates (name, source_url, image_path, perceptual_hash,
                panel_count, panel_layout, origin_source)
            VALUES (:name, :url, :path, :phash, :panels, :layout, 'imgflip')
            ON CONFLICT (name) DO NOTHING
        """), {
            "name": name,
            "url": url,
            "path": img_path,
            "phash": phash,
            "panels": box_count,
            "layout": layout,
        })
        ingested += 1

    session.commit()
    print(f"Ingested {ingested} templates from Imgflip")
    return ingested


async def identify_template(session, image_url: str, threshold: int = 12) -> dict | None:
    """Identify a meme template by its image using pHash matching.

    Args:
        session: DB session
        image_url: URL of the meme image to identify
        threshold: max Hamming distance for pHash match (lower = stricter)

    Returns:
        Matching template dict or None
    """
    img = await download_image(image_url)
    if not img:
        return None

    query_hash = compute_phash(img)

    # Get all templates with hashes
    result = session.execute(text("""
        SELECT id, name, perceptual_hash, source_url, panel_count, panel_layout,
               panel_descriptions, typical_humor_type
        FROM meme_templates
        WHERE perceptual_hash IS NOT NULL
    """))

    best_match = None
    best_distance = threshold + 1

    for row in result.fetchall():
        if row.perceptual_hash:
            distance = phash_distance(query_hash, row.perceptual_hash)
            if distance < best_distance:
                best_distance = distance
                best_match = {
                    "id": str(row.id),
                    "name": row.name,
                    "source_url": row.source_url,
                    "panel_count": row.panel_count,
                    "panel_layout": row.panel_layout,
                    "panel_descriptions": row.panel_descriptions,
                    "typical_humor_type": row.typical_humor_type,
                    "match_distance": distance,
                    "match_confidence": max(0, 1.0 - (distance / 64.0)),
                }

    if best_match:
        # Update usage stats
        session.execute(text("""
            UPDATE meme_templates SET usage_count = usage_count + 1, last_seen_at = NOW()
            WHERE id = :id
        """), {"id": best_match["id"]})
        session.commit()

    return best_match


async def add_template_from_discovery(session, name: str, image_url: str, metadata: dict = None) -> str | None:
    """Add a newly discovered meme template to the database."""
    ensure_template_dir()

    # Check if already exists
    existing = session.execute(
        text("SELECT id FROM meme_templates WHERE name = :name"),
        {"name": name}
    ).fetchone()

    if existing:
        return str(existing.id)

    img = await download_image(image_url)
    if not img:
        return None

    phash = compute_phash(img)

    safe_name = name.replace("/", "_").replace(" ", "_")[:50]
    img_path = f"{TEMPLATE_DIR}/{safe_name}.jpg"
    try:
        img.convert("RGB").save(img_path, "JPEG")
    except Exception:
        img_path = None

    result = session.execute(text("""
        INSERT INTO meme_templates (name, source_url, image_path, perceptual_hash,
            typical_humor_type, typical_sentiment, origin_source)
        VALUES (:name, :url, :path, :phash, :humor, :sentiment, 'discovered')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    """), {
        "name": name,
        "url": image_url,
        "path": img_path,
        "phash": phash,
        "humor": (metadata or {}).get("humor_type"),
        "sentiment": (metadata or {}).get("target_sentiment"),
    })
    session.commit()

    row = result.fetchone()
    return str(row.id) if row else None


def update_template_context(session, template_name: str, new_context: dict):
    """Track how a meme's meaning/usage shifts over time."""
    session.execute(text("""
        UPDATE meme_templates
        SET context_history = context_history || :context::jsonb
        WHERE name = :name
    """), {
        "name": template_name,
        "context": json.dumps([new_context]),
    })
    session.commit()
