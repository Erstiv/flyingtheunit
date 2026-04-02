import asyncio
import time


class TokenBucket:
    """Simple token bucket rate limiter for adapter-level throttling."""

    def __init__(self, rate: float, capacity: int):
        self.rate = rate  # tokens per second
        self.capacity = capacity
        self.tokens = capacity
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self._last_refill = now

            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1


class CircuitBreaker:
    """Circuit breaker to avoid hammering a broken platform API."""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = 0.0
        self.is_open = False

    def record_success(self):
        self.failures = 0
        self.is_open = False

    def record_failure(self):
        self.failures += 1
        self.last_failure_time = time.monotonic()
        if self.failures >= self.failure_threshold:
            self.is_open = True

    def can_execute(self) -> bool:
        if not self.is_open:
            return True
        if time.monotonic() - self.last_failure_time > self.recovery_timeout:
            self.is_open = False
            self.failures = 0
            return True
        return False
