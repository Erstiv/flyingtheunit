"""Meme Compositor — combine scene frames with meme templates using Pillow."""
import os
import uuid
import httpx
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = "/app/data/generated_memes"


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


async def download_image_bytes(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


def get_meme_font(size: int = 40):
    """Get Impact font for meme text. Falls back to default if not available."""
    font_paths = [
        "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",
        "/usr/share/fonts/truetype/impact.ttf",
        "/usr/share/fonts/Impact.ttf",
        "/app/data/fonts/impact.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    # Fallback to default
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except Exception:
        return ImageFont.load_default()


def draw_meme_text(draw: ImageDraw.Draw, text: str, position: tuple,
                   max_width: int, font_size: int = 40, color: str = "white"):
    """Draw meme-style text with outline/stroke."""
    font = get_meme_font(font_size)
    text = text.upper()

    # Word wrap
    words = text.split()
    lines = []
    current_line = ""
    for word in words:
        test = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > max_width - 20:
            if current_line:
                lines.append(current_line)
            current_line = word
        else:
            current_line = test
    if current_line:
        lines.append(current_line)

    # Calculate total height
    line_height = font_size + 5
    total_height = len(lines) * line_height

    # Draw each line centered
    x, y = position
    y -= total_height // 2

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        line_x = x - text_width // 2

        # Draw outline (stroke)
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                draw.text((line_x + dx, y + dy), line, fill="black", font=font)
        # Draw main text
        draw.text((line_x, y), line, fill=color, font=font)
        y += line_height


async def composite_top_bottom(scene_images: list[bytes], texts: list[str],
                                width: int = 600) -> str:
    """Create a top/bottom meme from two scene images and text."""
    ensure_output_dir()

    panels = []
    panel_height = width * 2 // 3  # 3:2 aspect per panel

    for img_bytes in scene_images[:2]:
        if img_bytes:
            img = Image.open(BytesIO(img_bytes)).convert("RGB")
            img = img.resize((width, panel_height), Image.LANCZOS)
            panels.append(img)
        else:
            # Placeholder panel
            panels.append(Image.new("RGB", (width, panel_height), (30, 30, 30)))

    # Stack panels vertically
    total_height = panel_height * len(panels)
    canvas = Image.new("RGB", (width, total_height))

    for i, panel in enumerate(panels):
        canvas.paste(panel, (0, i * panel_height))

    # Draw text — center within each panel
    draw = ImageDraw.Draw(canvas)
    if texts and len(texts) > 0 and texts[0]:
        draw_meme_text(draw, texts[0],
                       (width // 2, panel_height // 2),
                       max_width=width, font_size=36)
    if texts and len(texts) > 1 and texts[1]:
        draw_meme_text(draw, texts[1],
                       (width // 2, panel_height + panel_height // 2),
                       max_width=width, font_size=36)

    # Save
    filename = f"{uuid.uuid4().hex[:12]}.jpg"
    output_path = f"{OUTPUT_DIR}/{filename}"
    canvas.save(output_path, "JPEG", quality=90)
    return output_path


async def composite_side_by_side(scene_images: list[bytes], texts: list[str],
                                   width: int = 800) -> str:
    """Create a side-by-side meme (like Drake format)."""
    ensure_output_dir()

    panel_width = width // 2
    panel_height = panel_width

    panels = []
    for img_bytes in scene_images[:2]:
        if img_bytes:
            img = Image.open(BytesIO(img_bytes)).convert("RGB")
            img = img.resize((panel_width, panel_height), Image.LANCZOS)
            panels.append(img)
        else:
            panels.append(Image.new("RGB", (panel_width, panel_height), (30, 30, 30)))

    canvas = Image.new("RGB", (width, panel_height * len(panels) // 2 * 2))

    # Drake-style: image left, text right, stacked
    for i, panel in enumerate(panels):
        canvas.paste(panel, (0, i * panel_height))

    draw = ImageDraw.Draw(canvas)
    for i, text in enumerate(texts[:2]):
        if text:
            draw_meme_text(draw, text,
                           (panel_width + panel_width // 2, i * panel_height + panel_height // 2),
                           max_width=panel_width, font_size=32)

    filename = f"{uuid.uuid4().hex[:12]}.jpg"
    output_path = f"{OUTPUT_DIR}/{filename}"
    canvas.save(output_path, "JPEG", quality=90)
    return output_path


async def composite_meme(layout: str, scene_urls: list[str], texts: list[str]) -> str | None:
    """Main entry point — composite a meme based on layout type.

    Returns path to generated image.
    """
    # Download scene images
    scene_images = []
    for url in scene_urls:
        if url:
            img_bytes = await download_image_bytes(url)
            scene_images.append(img_bytes)
        else:
            scene_images.append(None)

    if layout in ("top_bottom", "vertical_2", "vertical_3"):
        return await composite_top_bottom(scene_images, texts)
    elif layout in ("side_by_side", "left_right"):
        return await composite_side_by_side(scene_images, texts)
    else:
        # Default to top/bottom
        return await composite_top_bottom(scene_images, texts)
