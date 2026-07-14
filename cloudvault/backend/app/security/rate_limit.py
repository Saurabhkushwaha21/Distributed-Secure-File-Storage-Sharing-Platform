"""
Simple fixed-window rate limiter backed by Redis, used for login brute-force
protection. Keyed by an identifier (e.g. "login:<email>" or "login:<ip>").
"""
import redis

from app.config import get_settings

settings = get_settings()
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


class RateLimitExceeded(Exception):
    pass


def check_and_increment(key: str, max_attempts: int, window_seconds: int) -> None:
    pipe = redis_client.pipeline()
    pipe.incr(key, 1)
    pipe.ttl(key)
    count, ttl = pipe.execute()

    if ttl == -1:
        redis_client.expire(key, window_seconds)

    if count > max_attempts:
        raise RateLimitExceeded(f"Too many attempts for '{key}'. Try again later.")


def reset(key: str) -> None:
    redis_client.delete(key)
