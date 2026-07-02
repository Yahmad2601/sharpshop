"""Lightweight in-process rate limiter for FastAPI (per-IP fixed window).

Single-process only, matching the app's in-memory session model. Every chat
message costs LLM tokens (and can trigger Flutterwave calls), so an
unauthenticated loop against the chat endpoint is a direct cost attack; this
caps it. For a multi-dyno deployment, back this with Redis instead.
"""
import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, per_minute: int, per_hour: int, now_fn: Callable[[], float] = time.time):
        self.per_minute = per_minute
        self.per_hour = per_hour
        self._now = now_fn
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    @staticmethod
    def client_ip(request: Request) -> str:
        # Behind Heroku/other proxies the real client is the first x-forwarded-for hop
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _prune(self, dq: Deque[float], now: float) -> None:
        cutoff = now - 3600
        while dq and dq[0] < cutoff:
            dq.popleft()

    def check(self, key: str) -> None:
        """Record a hit for `key`, raising HTTPException(429) if over a limit."""
        now = self._now()
        dq = self._hits[key]
        self._prune(dq, now)

        if len(dq) >= self.per_hour:
            raise HTTPException(status_code=429, detail="Hourly rate limit exceeded. Please try again later.")

        minute_ago = now - 60
        recent = sum(1 for t in dq if t >= minute_ago)
        if recent >= self.per_minute:
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

        dq.append(now)

        # Opportunistic memory bound: drop keys that have gone idle
        if len(self._hits) > 10_000:
            for k in [k for k, d in self._hits.items() if not d]:
                del self._hits[k]

    async def __call__(self, request: Request) -> None:
        # Usable directly as a FastAPI dependency
        self.check(self.client_ip(request))
