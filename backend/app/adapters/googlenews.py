import httpx
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from app.adapters.base import AbstractAdapter, RawPost

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"


class GoogleNewsAdapter(AbstractAdapter):
    """Google News adapter using the public RSS feed (free, no auth)."""
    platform_name = "googlenews"

    def __init__(self):
        super().__init__(rate=1.0, capacity=10)

    def is_configured(self) -> bool:
        return True  # Public RSS, no auth needed

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 50) -> list[RawPost]:
        await self._throttled_request()
        posts = []

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            try:
                params = {
                    "q": query,
                    "hl": "en-US",
                    "gl": "US",
                    "ceid": "US:en",
                }
                resp = await client.get(GOOGLE_NEWS_RSS, params=params)
                resp.raise_for_status()
                xml = resp.text

                # Parse RSS XML (lightweight, no lxml dependency)
                items = re.findall(r"<item>(.*?)</item>", xml, re.DOTALL)

                for item_xml in items[:limit]:
                    title = _extract_tag(item_xml, "title")
                    link = _extract_tag(item_xml, "link")
                    pub_date = _extract_tag(item_xml, "pubDate")
                    source = _extract_tag(item_xml, "source")
                    description = _extract_tag(item_xml, "description")

                    # Clean HTML from description
                    if description:
                        description = re.sub(r"<[^>]+>", " ", description).strip()
                        description = re.sub(r"\s+", " ", description)

                    # Parse date
                    created = None
                    if pub_date:
                        try:
                            created = parsedate_to_datetime(pub_date)
                            if created.tzinfo is None:
                                created = created.replace(tzinfo=timezone.utc)
                        except Exception:
                            pass

                    if since and created and created < since:
                        continue
                    if until and created and created > until:
                        continue

                    # Use Google News redirect URL as platform_id
                    platform_id = link or title or ""

                    post = RawPost(
                        platform="googlenews",
                        platform_id=platform_id[:500],
                        author_id=source,
                        author_username=source or "Unknown Source",
                        author_display_name=source or "Unknown Source",
                        content=f"{title}\n\n{description}" if description else title or "",
                        url=link,
                        engagement={},
                        raw_metadata={
                            "source": source,
                            "type": "news_article",
                        },
                        created_at=created,
                    )
                    posts.append(post)

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Google News search failed: {e}") from e

        return posts


def _extract_tag(xml: str, tag: str) -> str | None:
    """Extract text content from an XML tag."""
    # Handle CDATA
    match = re.search(rf"<{tag}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", xml, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None
