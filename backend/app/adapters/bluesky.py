import httpx
from datetime import datetime, timezone
from app.adapters.base import AbstractAdapter, RawPost, UserProfile
from app.core.config import get_settings

BSKY_PUBLIC = "https://public.api.bsky.app"
BSKY_AUTH = "https://bsky.social"


class BlueskyAdapter(AbstractAdapter):
    """Bluesky adapter using the AT Protocol. Auth required for post search."""
    platform_name = "bluesky"

    def __init__(self):
        super().__init__(rate=2.0, capacity=20)
        settings = get_settings()
        self._handle = settings.bluesky_handle
        self._app_password = settings.bluesky_app_password
        self._access_token = None

    def is_configured(self) -> bool:
        return bool(self._handle and self._app_password)

    async def _ensure_auth(self, client: httpx.AsyncClient):
        """Authenticate with Bluesky and get access token."""
        if self._access_token:
            return
        resp = await client.post(
            f"{BSKY_AUTH}/xrpc/com.atproto.server.createSession",
            json={"identifier": self._handle, "password": self._app_password},
        )
        resp.raise_for_status()
        data = resp.json()
        self._access_token = data.get("accessJwt")

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 50) -> list[RawPost]:
        await self._throttled_request()
        posts = []

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                await self._ensure_auth(client)

                params = {
                    "q": query,
                    "limit": min(limit, 100),
                    "sort": "latest",
                }
                resp = await client.get(
                    f"{BSKY_AUTH}/xrpc/app.bsky.feed.searchPosts",
                    params=params,
                    headers={"Authorization": f"Bearer {self._access_token}"},
                )

                # If token expired, retry once
                if resp.status_code == 401:
                    self._access_token = None
                    await self._ensure_auth(client)
                    resp = await client.get(
                        f"{BSKY_AUTH}/xrpc/app.bsky.feed.searchPosts",
                        params=params,
                        headers={"Authorization": f"Bearer {self._access_token}"},
                    )

                resp.raise_for_status()
                data = resp.json()

                for item in data.get("posts", []):
                    record = item.get("record", {})
                    author = item.get("author", {})
                    created_str = record.get("createdAt", "")

                    try:
                        created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                    except (ValueError, AttributeError):
                        created = None

                    if since and created and created < since:
                        continue
                    if until and created and created > until:
                        continue

                    # Build post URL from URI: at://did/app.bsky.feed.post/rkey
                    uri = item.get("uri", "")
                    handle = author.get("handle", "")
                    rkey = uri.split("/")[-1] if "/" in uri else ""
                    post_url = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else ""

                    # Extract image URLs if present
                    media_urls = []
                    embed = item.get("embed", {})
                    if embed.get("$type") == "app.bsky.embed.images#view":
                        for img in embed.get("images", []):
                            if img.get("fullsize"):
                                media_urls.append(img["fullsize"])

                    post = RawPost(
                        platform="bluesky",
                        platform_id=uri,
                        author_id=author.get("did"),
                        author_username=handle,
                        author_display_name=author.get("displayName", handle),
                        content=record.get("text", ""),
                        url=post_url,
                        media_urls=media_urls,
                        engagement={
                            "likes": item.get("likeCount", 0),
                            "reposts": item.get("repostCount", 0),
                            "replies": item.get("replyCount", 0),
                            "quotes": item.get("quoteCount", 0),
                        },
                        raw_metadata={
                            "labels": [l.get("val") for l in item.get("labels", [])],
                            "langs": record.get("langs", []),
                        },
                        created_at=created,
                    )
                    posts.append(post)

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Bluesky search failed: {e}") from e

        return posts

    async def get_user_profile(self, user_id: str) -> UserProfile | None:
        await self._throttled_request()

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.get(f"{BSKY_PUBLIC}/xrpc/app.bsky.actor.getProfile", params={"actor": user_id})
                resp.raise_for_status()
                data = resp.json()

                self.circuit_breaker.record_success()
                return UserProfile(
                    platform="bluesky",
                    platform_user_id=data.get("did", ""),
                    username=data.get("handle"),
                    display_name=data.get("displayName"),
                    bio=data.get("description", ""),
                    profile_url=f"https://bsky.app/profile/{data.get('handle', '')}",
                    avatar_url=data.get("avatar"),
                    follower_count=data.get("followersCount"),
                    following_count=data.get("followsCount"),
                    raw_profile={
                        "posts_count": data.get("postsCount", 0),
                    },
                )
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Bluesky profile fetch failed: {e}") from e
