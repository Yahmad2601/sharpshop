"""Tests for the in-process rate limiter."""
import pytest
from fastapi import HTTPException

from rate_limit import RateLimiter


class FakeClock:
    def __init__(self, t=1000.0):
        self.t = t
    def __call__(self):
        return self.t
    def advance(self, seconds):
        self.t += seconds


def test_allows_under_limit():
    limiter = RateLimiter(per_minute=5, per_hour=100, now_fn=FakeClock())
    for _ in range(5):
        limiter.check("1.1.1.1")  # no raise


def test_blocks_over_per_minute():
    limiter = RateLimiter(per_minute=3, per_hour=100, now_fn=FakeClock())
    for _ in range(3):
        limiter.check("1.1.1.1")
    with pytest.raises(HTTPException) as exc:
        limiter.check("1.1.1.1")
    assert exc.value.status_code == 429


def test_minute_window_resets():
    clock = FakeClock()
    limiter = RateLimiter(per_minute=2, per_hour=100, now_fn=clock)
    limiter.check("1.1.1.1")
    limiter.check("1.1.1.1")
    with pytest.raises(HTTPException):
        limiter.check("1.1.1.1")
    # after 61s the minute window has rolled over
    clock.advance(61)
    limiter.check("1.1.1.1")  # allowed again


def test_hourly_limit():
    clock = FakeClock()
    limiter = RateLimiter(per_minute=1000, per_hour=5, now_fn=clock)
    for _ in range(5):
        limiter.check("1.1.1.1")
        clock.advance(61)  # avoid the per-minute cap
    with pytest.raises(HTTPException) as exc:
        limiter.check("1.1.1.1")
    assert exc.value.status_code == 429


def test_ips_are_independent():
    limiter = RateLimiter(per_minute=2, per_hour=100, now_fn=FakeClock())
    limiter.check("1.1.1.1")
    limiter.check("1.1.1.1")
    # a different IP has its own budget
    limiter.check("2.2.2.2")
    limiter.check("2.2.2.2")
    with pytest.raises(HTTPException):
        limiter.check("2.2.2.2")


def test_client_ip_prefers_forwarded_header():
    class Req:
        headers = {"x-forwarded-for": "203.0.113.9, 10.0.0.1"}
        client = type("C", (), {"host": "10.0.0.1"})()
    assert RateLimiter.client_ip(Req()) == "203.0.113.9"


def test_client_ip_falls_back_to_socket():
    class Req:
        headers = {}
        client = type("C", (), {"host": "198.51.100.7"})()
    assert RateLimiter.client_ip(Req()) == "198.51.100.7"
