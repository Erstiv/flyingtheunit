import httpx
from datetime import datetime, timezone
from app.adapters.base import AbstractAdapter, RawPost
from app.core.config import get_settings

IMGUR_API = "https://api.imgur.com/3"
# Imgur Client-ID for anonymous access (free, 12.5k requests/day)
# Register at https://api.imgur.com/oauth2/addclient
IMGUR_CLIENT_ID = "546c25a59c58ad7"  # Public demo client ID - replace with own


class ImgurAdapter(AbstractAdapter):
    """Imgur adapter — rich source of memes and viral images."""
    platform_name = "imgur"

    def __init__(self):
        super().__init__(rate=1.0, capacity=15)

    def is_configured(self) -> bool:
        return True

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 50) -> list[RawPost]:
        await self._throttled_request()
        posts = []

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                # Search gallery
                resp = await client.get(
                    f"{IMGUR_API}/gallery/search/time/all/1",
                    params={"q": query},
                    headers={"Authorization": f"Client-ID {IMGUR_CLIENT_ID}"},
                )
                resp.raise_for_status()
                data = resp.json()

                for item in data.get("data", [])[:limit]:
                    created = datetime.fromtimestamp(item.get("datetime", 0), tz=timezone.utc)

                    if since and created < since:
                        continue
                    if until and created > until:
                        continue

                    # Get the best image URL
                    if item.get("is_album") and item.get("images"):
                        image_url = item["images"][0].get("link", "")
                        media_urls = [img.get("link", "") for img in item.get("images", [])[:5]]
                    else:
                        image_url = item.get("link", "")
                        media_urls = [image_url] if image_url else []

                    content = item.get("title", "")
                    if item.get("description"):
                        content += "\n\n" + item["description"]

                    post = RawPost(
                        platform="imgur",
                        platform_id=item.get("id", ""),
                        author_id=str(item.get("account_id", "")),
                        author_username=item.get("account_url", "anonymous"),
                        author_display_name=item.get("account_url", "anonymous"),
                        content=content,
                        url=f"https://imgur.com/gallery/{item.get('id', '')}",
                        media_urls=media_urls,
                        engagement={
                            "views": item.get("views", 0),
                            "ups": item.get("ups", 0),
                            "downs": item.get("downs", 0),
                            "points": item.get("points", 0),
                            "score": item.get("score", 0),
                            "comment_count": item.get("comment_count", 0),
                            "favorite_count": item.get("favorite_count", 0),
                        },
                        raw_metadata={
                            "is_album": item.get("is_album", False),
                            "nsfw": item.get("nsfw", False),
                            "section": item.get("section", ""),
                            "topic": item.get("topic", ""),
                            "image_url": image_url,
                            "is_meme": True,  # Flag for meme analysis pipeline
                        },
                        created_at=created,
                    )
                    posts.append(post)

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Imgur search failed: {e}") from e

        return posts
