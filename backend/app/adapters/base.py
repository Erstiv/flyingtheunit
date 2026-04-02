from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import AsyncGenerator
from app.core.rate_limiter import TokenBucket, CircuitBreaker


@dataclass
class RawPost:
    """Normalized post from any platform."""
    platform: str
    platform_id: str
    author_id: str | None = None
    author_username: str | None = None
    author_display_name: str | None = None
    content: str | None = None
    content_html: str | None = None
    url: str | None = None
    parent_platform_id: str | None = None
    thread_root_platform_id: str | None = None
    media_urls: list[str] = field(default_factory=list)
    engagement: dict = field(default_factory=dict)
    raw_metadata: dict = field(default_factory=dict)
    created_at: datetime | None = None


@dataclass
class UserProfile:
    """Normalized user profile from any platform."""
    platform: str
    platform_user_id: str
    username: str | None = None
    display_name: str | None = None
    bio: str | None = None
    profile_url: str | None = None
    avatar_url: str | None = None
    follower_count: int | None = None
    following_count: int | None = None
    raw_profile: dict = field(default_factory=dict)


@dataclass
class Connection:
    """A relationship between two users."""
    source_platform_user_id: str
    target_platform_user_id: str
    relationship_type: str  # follows, mentions, collaborates_with
    platform: str


class AbstractAdapter(ABC):
    """Base class for all platform adapters."""

    platform_name: str = "unknown"

    def __init__(self, rate: float = 1.0, capacity: int = 10):
        self.rate_limiter = TokenBucket(rate=rate, capacity=capacity)
        self.circuit_breaker = CircuitBreaker()

    @abstractmethod
    async def search(self, query: str, since: datetime | None = None, until: datetime | None = None, limit: int = 100) -> list[RawPost]:
        """Search for posts matching query."""
        ...

    async def get_user_profile(self, user_id: str) -> UserProfile | None:
        """Get user profile. Override in subclass if supported."""
        return None

    async def get_connections(self, user_id: str) -> list[Connection]:
        """Get user connections. Override in subclass if supported."""
        return []

    async def get_post_thread(self, post_id: str) -> list[RawPost]:
        """Get full thread for a post. Override in subclass if supported."""
        return []

    async def stream(self, keywords: list[str]) -> AsyncGenerator[RawPost, None]:
        """Stream posts in real-time. Override in subclass if supported."""
        return
        yield  # make it a generator

    def is_configured(self) -> bool:
        """Check if this adapter has the required credentials."""
        return True

    async def _throttled_request(self):
        """Wait for rate limiter before making a request."""
        if not self.circuit_breaker.can_execute():
            raise ConnectionError(f"{self.platform_name} circuit breaker is open")
        await self.rate_limiter.acquire()
