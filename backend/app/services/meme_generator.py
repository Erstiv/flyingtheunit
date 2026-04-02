import httpx

IMGFLIP_API = "https://api.imgflip.com"

# Top meme templates with their Imgflip IDs
POPULAR_TEMPLATES = {
    "drake": {"id": "181913649", "name": "Drake Hotline Bling"},
    "distracted_boyfriend": {"id": "112126428", "name": "Distracted Boyfriend"},
    "change_my_mind": {"id": "129242436", "name": "Change My Mind"},
    "two_buttons": {"id": "87743020", "name": "Two Buttons"},
    "expanding_brain": {"id": "93895088", "name": "Expanding Brain"},
    "one_does_not_simply": {"id": "61579", "name": "One Does Not Simply"},
    "batman_slapping": {"id": "438680", "name": "Batman Slapping Robin"},
    "disaster_girl": {"id": "97984", "name": "Disaster Girl"},
    "hide_the_pain": {"id": "27813981", "name": "Hide the Pain Harold"},
    "is_this_a": {"id": "100947", "name": "Is This A Pigeon"},
    "always_has_been": {"id": "252600902", "name": "Always Has Been"},
    "they_are_the_same": {"id": "180190441", "name": "They're The Same Picture"},
    "bernie_asking": {"id": "222403160", "name": "Bernie I Am Once Again Asking"},
    "woman_yelling_cat": {"id": "188390779", "name": "Woman Yelling At Cat"},
    "mr_incredible": {"id": "370867422", "name": "Mr Incredible Becoming Uncanny"},
    "left_exit_12": {"id": "124822590", "name": "Left Exit 12 Off Ramp"},
    "running_away_balloon": {"id": "131087935", "name": "Running Away Balloon"},
    "this_is_fine": {"id": "55311130", "name": "This Is Fine"},
    "think_about_it": {"id": "101470", "name": "Roll Safe Think About It"},
    "stonks": {"id": "259237855", "name": "Stonks"},
}


async def get_popular_templates() -> list[dict]:
    """Fetch current popular meme templates from Imgflip."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{IMGFLIP_API}/get_memes")
        resp.raise_for_status()
        data = resp.json()
        return [
            {
                "id": meme["id"],
                "name": meme["name"],
                "url": meme["url"],
                "width": meme["width"],
                "height": meme["height"],
                "box_count": meme["box_count"],
            }
            for meme in data.get("data", {}).get("memes", [])[:50]
        ]


async def generate_meme(
    template_id: str,
    top_text: str,
    bottom_text: str,
    username: str = "",
    password: str = "",
) -> dict | None:
    """Generate a meme using Imgflip API.

    Note: Imgflip requires a free account for the caption API.
    Register at https://imgflip.com/signup
    Without credentials, returns the template URL with text overlay info.
    """
    if username and password:
        # Use Imgflip caption API (requires free account)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{IMGFLIP_API}/caption_image",
                data={
                    "template_id": template_id,
                    "username": username,
                    "password": password,
                    "text0": top_text,
                    "text1": bottom_text,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("success"):
                return {
                    "url": data["data"]["url"],
                    "page_url": data["data"]["page_url"],
                    "template_id": template_id,
                    "top_text": top_text,
                    "bottom_text": bottom_text,
                }

    # Fallback: return template info for manual creation
    template = None
    for t in POPULAR_TEMPLATES.values():
        if t["id"] == template_id:
            template = t
            break

    return {
        "url": None,
        "template_id": template_id,
        "template_name": template["name"] if template else "Unknown",
        "top_text": top_text,
        "bottom_text": bottom_text,
        "message": "Set IMGFLIP_USERNAME and IMGFLIP_PASSWORD in .env to auto-generate. Free signup at imgflip.com/signup",
    }


def find_template_by_name(name: str) -> dict | None:
    """Fuzzy match a template name to our known templates."""
    name_lower = name.lower()
    for key, template in POPULAR_TEMPLATES.items():
        if key in name_lower or template["name"].lower() in name_lower:
            return template

    # Partial matching
    for key, template in POPULAR_TEMPLATES.items():
        words = key.split("_")
        if any(w in name_lower for w in words if len(w) > 3):
            return template

    return None
