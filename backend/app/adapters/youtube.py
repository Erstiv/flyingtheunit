import httpx
from datetime import datetime, timezone
from app.adapters.base import AbstractAdapter, RawPost, UserProfile
from app.core.config import get_settings

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
YOUTUBE_COMMENTS_URL = "https://www.googleapis.com/youtube/v3/commentThreads"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"


class YouTubeAdapter(AbstractAdapter):
    platform_name = "youtube"

    def __init__(self):
        # YouTube: 10k units/day, search costs 100 units each
        super().__init__(rate=0.5, capacity=10)
        settings = get_settings()
        self._api_key = settings.youtube_api_key

    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 50) -> list[RawPost]:
        if not self.is_configured():
            return []

        await self._throttled_request()
        posts = []

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                # Search for videos (100 units per call)
                params = {
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "order": "date",
                    "maxResults": min(limit, 50),
                    "key": self._api_key,
                }
                if since:
                    params["publishedAfter"] = since.strftime("%Y-%m-%dT%H:%M:%SZ")
                if until:
                    params["publishedBefore"] = until.strftime("%Y-%m-%dT%H:%M:%SZ")

                resp = await client.get(YOUTUBE_SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

                video_ids = []
                snippets = {}

                for item in data.get("items", []):
                    vid_id = item["id"]["videoId"]
                    video_ids.append(vid_id)
                    snippets[vid_id] = item["snippet"]

                # Get video stats (1 unit per call)
                if video_ids:
                    stats_resp = await client.get(YOUTUBE_VIDEOS_URL, params={
                        "part": "statistics",
                        "id": ",".join(video_ids),
                        "key": self._api_key,
                    })
                    stats_resp.raise_for_status()
                    stats_data = {
                        item["id"]: item["statistics"]
                        for item in stats_resp.json().get("items", [])
                    }
                else:
                    stats_data = {}

                for vid_id in video_ids:
                    snippet = snippets[vid_id]
                    stats = stats_data.get(vid_id, {})
                    published = datetime.fromisoformat(
                        snippet["publishedAt"].replace("Z", "+00:00")
                    )

                    post = RawPost(
                        platform="youtube",
                        platform_id=vid_id,
                        author_id=snippet.get("channelId"),
                        author_username=snippet.get("channelTitle"),
                        author_display_name=snippet.get("channelTitle"),
                        content=f"{snippet.get('title', '')}\n\n{snippet.get('description', '')}",
                        url=f"https://www.youtube.com/watch?v={vid_id}",
                        media_urls=[snippet.get("thumbnails", {}).get("high", {}).get("url", "")],
                        engagement={
                            "views": int(stats.get("viewCount", 0)),
                            "likes": int(stats.get("likeCount", 0)),
                            "comments": int(stats.get("commentCount", 0)),
                        },
                        raw_metadata={
                            "title": snippet.get("title"),
                            "channel_id": snippet.get("channelId"),
                            "channel_title": snippet.get("channelTitle"),
                        },
                        created_at=published,
                    )
                    posts.append(post)

                # Also fetch comments for these videos (costs 1 unit each)
                for vid_id in video_ids[:5]:  # limit to top 5 videos to save quota
                    try:
                        comments = await self._fetch_comments(client, vid_id)
                        posts.extend(comments)
                    except Exception:
                        pass

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"YouTube search failed: {e}") from e

        return posts

    async def _fetch_comments(self, client: httpx.AsyncClient, video_id: str, limit: int = 20) -> list[RawPost]:
        """Fetch top-level comments for a video."""
        await self.rate_limiter.acquire()

        resp = await client.get(YOUTUBE_COMMENTS_URL, params={
            "part": "snippet",
            "videoId": video_id,
            "order": "relevance",
            "maxResults": min(limit, 100),
            "key": self._api_key,
        })
        resp.raise_for_status()
        data = resp.json()

        comments = []
        for item in data.get("items", []):
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            published = datetime.fromisoformat(
                snippet["publishedAt"].replace("Z", "+00:00")
            )

            comments.append(RawPost(
                platform="youtube",
                platform_id=item["id"],
                author_id=snippet.get("authorChannelId", {}).get("value"),
                author_username=snippet.get("authorDisplayName"),
                author_display_name=snippet.get("authorDisplayName"),
                content=snippet.get("textOriginal", ""),
                url=f"https://www.youtube.com/watch?v={video_id}&lc={item['id']}",
                parent_platform_id=video_id,
                thread_root_platform_id=video_id,
                engagement={
                    "likes": snippet.get("likeCount", 0),
                    "replies": item["snippet"].get("totalReplyCount", 0),
                },
                raw_metadata={
                    "video_id": video_id,
                    "is_comment": True,
                },
                created_at=published,
            ))

        return comments

    async def get_user_profile(self, user_id: str) -> UserProfile | None:
        if not self.is_configured():
            return None

        await self._throttled_request()

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.get(YOUTUBE_CHANNELS_URL, params={
                    "part": "snippet,statistics",
                    "id": user_id,
                    "key": self._api_key,
                })
                resp.raise_for_status()
                items = resp.json().get("items", [])
                if not items:
                    return None

                channel = items[0]
                snippet = channel["snippet"]
                stats = channel.get("statistics", {})

                self.circuit_breaker.record_success()
                return UserProfile(
                    platform="youtube",
                    platform_user_id=channel["id"],
                    username=snippet.get("customUrl", snippet.get("title")),
                    display_name=snippet.get("title"),
                    bio=snippet.get("description", ""),
                    profile_url=f"https://www.youtube.com/channel/{channel['id']}",
                    avatar_url=snippet.get("thumbnails", {}).get("default", {}).get("url"),
                    follower_count=int(stats.get("subscriberCount", 0)),
                    raw_profile={
                        "view_count": int(stats.get("viewCount", 0)),
                        "video_count": int(stats.get("videoCount", 0)),
                    },
                )
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"YouTube channel fetch failed: {e}") from e
