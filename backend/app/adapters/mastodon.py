import httpx
from datetime import datetime, timezone
from app.adapters.base import AbstractAdapter, RawPost, UserProfile

# mastodon.social is the largest instance — its search covers federated content
MASTODON_API = "https://mastodon.social/api"


class MastodonAdapter(AbstractAdapter):
    """Mastodon adapter using the public API (no auth needed for search)."""
    platform_name = "mastodon"

    def __init__(self):
        super().__init__(rate=2.0, capacity=20)

    def is_configured(self) -> bool:
        return True  # Public API, no auth needed

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 50) -> list[RawPost]:
        await self._throttled_request()
        posts = []

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                params = {
                    "q": query,
                    "type": "statuses",
                    "limit": min(limit, 40),
                }
                resp = await client.get(f"{MASTODON_API}/v2/search", params=params)
                resp.raise_for_status()
                data = resp.json()

                for status in data.get("statuses", []):
                    created_str = status.get("created_at", "")
                    try:
                        created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                    except (ValueError, AttributeError):
                        created = None

                    if since and created and created < since:
                        continue
                    if until and created and created > until:
                        continue

                    account = status.get("account", {})

                    # Strip HTML tags from content
                    content = status.get("content", "")
                    if content:
                        import re
                        content = re.sub(r"<[^>]+>", " ", content).strip()
                        content = re.sub(r"\s+", " ", content)

                    # Extract media URLs
                    media_urls = []
                    for attachment in status.get("media_attachments", []):
                        if attachment.get("url"):
                            media_urls.append(attachment["url"])

                    # Build instance-aware URL
                    post_url = status.get("url") or status.get("uri", "")

                    post = RawPost(
                        platform="mastodon",
                        platform_id=status.get("uri", status.get("id", "")),
                        author_id=account.get("id"),
                        author_username=f"{account.get('acct', '')}",
                        author_display_name=account.get("display_name", account.get("username", "")),
                        content=content,
                        url=post_url,
                        media_urls=media_urls,
                        engagement={
                            "favourites": status.get("favourites_count", 0),
                            "reblogs": status.get("reblogs_count", 0),
                            "replies": status.get("replies_count", 0),
                        },
                        raw_metadata={
                            "visibility": status.get("visibility"),
                            "language": status.get("language"),
                            "instance": account.get("url", "").split("/")[2] if account.get("url") else None,
                            "is_reblog": status.get("reblog") is not None,
                            "tags": [t.get("name") for t in status.get("tags", [])],
                        },
                        created_at=created,
                    )
                    posts.append(post)

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Mastodon search failed: {e}") from e

        return posts

    async def get_user_profile(self, user_id: str) -> UserProfile | None:
        await self._throttled_request()

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                # Search for user by username
                resp = await client.get(f"{MASTODON_API}/v2/search", params={"q": user_id, "type": "accounts", "limit": 1})
                resp.raise_for_status()
                accounts = resp.json().get("accounts", [])
                if not accounts:
                    return None

                data = accounts[0]
                self.circuit_breaker.record_success()
                return UserProfile(
                    platform="mastodon",
                    platform_user_id=data.get("id", ""),
                    username=data.get("acct"),
                    display_name=data.get("display_name"),
                    bio=data.get("note", ""),
                    profile_url=data.get("url"),
                    avatar_url=data.get("avatar"),
                    follower_count=data.get("followers_count"),
                    following_count=data.get("following_count"),
                    raw_profile={
                        "statuses_count": data.get("statuses_count", 0),
                    },
                )
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Mastodon profile fetch failed: {e}") from e
