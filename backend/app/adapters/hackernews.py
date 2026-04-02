import httpx
from datetime import datetime, timezone
from app.adapters.base import AbstractAdapter, RawPost

HN_API = "https://hn.algolia.com/api/v1"


class HackerNewsAdapter(AbstractAdapter):
    """Hacker News adapter using the Algolia search API (free, no auth)."""
    platform_name = "hackernews"

    def __init__(self):
        # HN Algolia API is generous
        super().__init__(rate=2.0, capacity=20)

    def is_configured(self) -> bool:
        return True

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 50) -> list[RawPost]:
        await self._throttled_request()
        posts = []

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                params = {
                    "query": query,
                    "tags": "(story,comment)",
                    "hitsPerPage": min(limit, 100),
                }
                if since:
                    params["numericFilters"] = f"created_at_i>{int(since.timestamp())}"

                resp = await client.get(f"{HN_API}/search_by_date", params=params)
                resp.raise_for_status()
                data = resp.json()

                for hit in data.get("hits", []):
                    created = datetime.fromtimestamp(
                        hit.get("created_at_i", 0), tz=timezone.utc
                    )

                    if until and created > until:
                        continue

                    is_story = hit.get("_tags", []) and "story" in hit["_tags"]
                    object_id = hit.get("objectID", "")

                    if is_story:
                        content = hit.get("title", "")
                        if hit.get("story_text"):
                            content += "\n\n" + hit["story_text"]
                        url = hit.get("url") or f"https://news.ycombinator.com/item?id={object_id}"
                        parent_id = None
                    else:
                        content = hit.get("comment_text", "")
                        # Strip HTML tags from comments
                        if content:
                            import re
                            content = re.sub(r"<[^>]+>", " ", content).strip()
                        url = f"https://news.ycombinator.com/item?id={object_id}"
                        parent_id = hit.get("parent_id")

                    post = RawPost(
                        platform="hackernews",
                        platform_id=object_id,
                        author_id=hit.get("author"),
                        author_username=hit.get("author"),
                        author_display_name=hit.get("author"),
                        content=content,
                        url=url,
                        parent_platform_id=str(parent_id) if parent_id else None,
                        thread_root_platform_id=str(hit.get("story_id")) if hit.get("story_id") else None,
                        engagement={
                            "points": hit.get("points") or 0,
                            "num_comments": hit.get("num_comments") or 0,
                        },
                        raw_metadata={
                            "type": "story" if is_story else "comment",
                            "story_title": hit.get("story_title"),
                            "story_url": hit.get("story_url"),
                        },
                        created_at=created,
                    )
                    posts.append(post)

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"HN search failed: {e}") from e

        return posts
