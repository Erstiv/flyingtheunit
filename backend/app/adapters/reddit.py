import asyncpraw
from datetime import datetime, timezone
from app.adapters.base import AbstractAdapter, RawPost, UserProfile
from app.core.config import get_settings


class RedditAdapter(AbstractAdapter):
    platform_name = "reddit"

    def __init__(self):
        # Reddit free tier: 100 requests/minute
        super().__init__(rate=1.5, capacity=30)
        settings = get_settings()
        self._client_id = settings.reddit_client_id
        self._client_secret = settings.reddit_client_secret
        self._user_agent = settings.reddit_user_agent

    def is_configured(self) -> bool:
        return bool(self._client_id and self._client_secret)

    def _get_client(self) -> asyncpraw.Reddit:
        return asyncpraw.Reddit(
            client_id=self._client_id,
            client_secret=self._client_secret,
            user_agent=self._user_agent,
        )

    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 100) -> list[RawPost]:
        if not self.is_configured():
            return []

        await self._throttled_request()
        posts = []

        async with self._get_client() as reddit:
            try:
                subreddit = await reddit.subreddit("all")
                async for submission in subreddit.search(query, sort="new", time_filter="day", limit=limit):
                    created = datetime.fromtimestamp(submission.created_utc, tz=timezone.utc)

                    if since and created < since:
                        continue
                    if until and created > until:
                        continue

                    post = RawPost(
                        platform="reddit",
                        platform_id=submission.id,
                        author_id=str(submission.author) if submission.author else None,
                        author_username=str(submission.author) if submission.author else "[deleted]",
                        author_display_name=str(submission.author) if submission.author else None,
                        content=submission.selftext or submission.title,
                        url=f"https://reddit.com{submission.permalink}",
                        media_urls=[submission.url] if submission.url and not submission.is_self else [],
                        engagement={
                            "score": submission.score,
                            "upvote_ratio": submission.upvote_ratio,
                            "num_comments": submission.num_comments,
                            "awards": submission.total_awards_received,
                        },
                        raw_metadata={
                            "subreddit": str(submission.subreddit),
                            "title": submission.title,
                            "is_self": submission.is_self,
                            "flair": submission.link_flair_text,
                            "over_18": submission.over_18,
                        },
                        created_at=created,
                    )
                    posts.append(post)

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Reddit search failed: {e}") from e

        return posts

    async def get_user_profile(self, user_id: str) -> UserProfile | None:
        if not self.is_configured():
            return None

        await self._throttled_request()

        async with self._get_client() as reddit:
            try:
                redditor = await reddit.redditor(user_id, fetch=True)
                self.circuit_breaker.record_success()
                return UserProfile(
                    platform="reddit",
                    platform_user_id=str(redditor.id),
                    username=redditor.name,
                    display_name=redditor.name,
                    bio=getattr(redditor, "subreddit", {}).get("public_description", ""),
                    profile_url=f"https://reddit.com/u/{redditor.name}",
                    avatar_url=getattr(redditor, "icon_img", None),
                    follower_count=None,  # not exposed by API
                    raw_profile={
                        "link_karma": redditor.link_karma,
                        "comment_karma": redditor.comment_karma,
                        "created_utc": redditor.created_utc,
                    },
                )
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Reddit profile fetch failed: {e}") from e

    async def get_post_thread(self, post_id: str) -> list[RawPost]:
        if not self.is_configured():
            return []

        await self._throttled_request()
        thread_posts = []

        async with self._get_client() as reddit:
            try:
                submission = await reddit.submission(post_id, fetch=True)
                await submission.comments.replace_more(limit=0)

                for comment in submission.comments.list():
                    created = datetime.fromtimestamp(comment.created_utc, tz=timezone.utc)
                    parent_id = comment.parent_id.split("_")[1] if comment.parent_id else None

                    thread_posts.append(RawPost(
                        platform="reddit",
                        platform_id=comment.id,
                        author_id=str(comment.author) if comment.author else None,
                        author_username=str(comment.author) if comment.author else "[deleted]",
                        content=comment.body,
                        url=f"https://reddit.com{comment.permalink}",
                        parent_platform_id=parent_id,
                        thread_root_platform_id=post_id,
                        engagement={
                            "score": comment.score,
                            "awards": comment.total_awards_received,
                        },
                        created_at=created,
                    ))

                self.circuit_breaker.record_success()
            except Exception as e:
                self.circuit_breaker.record_failure()
                raise ConnectionError(f"Reddit thread fetch failed: {e}") from e

        return thread_posts
